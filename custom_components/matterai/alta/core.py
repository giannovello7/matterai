"""Alta de dispositivos: una sola implementación para Matte (conversación) y para el asistente en pantallas.

- Coordinadores Zigbee: Zigbee2MQTT (uno o varios, por su base_topic) y/o ZHA.
- Unión: siempre con vencimiento (máx. 254 s). Se cierra sola al vencer, al cancelar o si se corta la sesión.
- Detección: cualquier dispositivo nuevo en el registro de HA (Zigbee, Matter, WiFi). Con Zigbee2MQTT, además, los
  avisos del puente («se unió», «configurando», «listo» / «falló») y lo que el equipo dice que es (marca, modelo, exposes).
- Todo queda en la auditoría. Los permisos los mira quien llama (ver `puede_agregar`).
"""

from __future__ import annotations

import asyncio
from collections.abc import Callable
import json
import logging
import time
import uuid
from typing import Any

from homeassistant.core import Event, HomeAssistant, callback
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.event import async_call_later

from ..const import DOMAIN
from .capacidades import nombre_sugerido, normalizar, sufijo

_LOGGER = logging.getLogger(__name__)

MAX_UNION = 254
DEFAULT_UNION = 180
MAX_ESPERA = 600
RESP_TIMEOUT = 4.0  # cuánto se espera la confirmación de Zigbee2MQTT
SETTLE = 2.0  # sin entidades nuevas durante esto = el equipo terminó de aparecer
MAX_SETTLE = 25.0
POLL = 0.25
RECIENTES = 1800  # un equipo nuevo se puede retomar hasta 30 min después
# dispositivos que aparecen solos y no son «equipos de la casa»
IGNORAR_DOMINIOS = {"mobile_app", DOMAIN, "hassio", "backup", "sun", "met", "radio_browser", "shopping_list", "google_translate"}


class AltaError(Exception):
    """Algo que no se pudo hacer (mensaje para el cliente, corto y en castellano)."""


def _payload(raw: Any) -> Any:
    if isinstance(raw, bytes):
        raw = raw.decode(errors="ignore")
    if isinstance(raw, str):
        s = raw.strip()
        if s.startswith(("{", "[")):
            try:
                return json.loads(s)
            except ValueError:
                return s
        return s
    return raw


def _major(version: str | None) -> int | None:
    try:
        return int(str(version).split(".")[0])
    except (TypeError, ValueError):
        return None


def permit_payload(version: str | None, segundos: int) -> dict[str, Any]:
    """Zigbee2MQTT 2.x sólo usa «time» (0 cierra); 1.x usa «value» (+ «time»). Si no se sabe la versión, las dos
    claves: cada versión lee la suya e ignora la otra."""
    m = _major(version)
    if m is not None and m >= 2:
        return {"time": segundos}
    if m is not None:
        return {"value": True, "time": segundos} if segundos else {"value": False}
    return {"value": bool(segundos), "time": segundos}


def z2m_ieee(device: dr.DeviceEntry) -> str | None:
    for domain, ident in device.identifiers:
        ident = str(ident)
        if domain == "mqtt" and ident.startswith("zigbee2mqtt_0x"):
            return ident[len("zigbee2mqtt_"):]
    return None


def zha_ieee(device: dr.DeviceEntry) -> str | None:
    for domain, ident in device.identifiers:
        if domain == "zha":
            return str(ident)
    return None


def _red(coords: list[dict[str, Any]]) -> str:
    tipos = {"Z-Wave" if c["tipo"] == "zwave" else "Zigbee" for c in coords}
    return " y ".join(sorted(tipos, key=lambda t: t != "Zigbee")) or "Zigbee"


class Alta:
    """Estado de la sesión de alta (una a la vez por casa) + herramientas."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self.z2m: dict[str, dict[str, Any]] = {}  # base_topic → {version, online, permit}
        self.union: dict[str, Any] | None = None  # {hasta, segundos, coords, quien}
        self.estado = "inactivo"  # inactivo · esperando · uniendo · configurando · encontrado
        self.detalle = ""
        self.desde = 0.0  # desde cuándo cuentan los equipos nuevos de esta sesión
        self.encontrados: list[dict[str, Any]] = []  # equipos listos todavía sin mostrar
        self.vistos: dict[str, float] = {}  # device_id → cuándo apareció (los últimos RECIENTES segundos)
        self.pendientes: dict[str, dict[str, Any]] = {}  # Zigbee2MQTT: ieee → lo que contó el equipo al unirse
        self.sesion: list[str] = []  # equipos agregados en esta sesión (para el resumen)
        self._waiters: list[asyncio.Future] = []
        self._resp: dict[str, asyncio.Future] = {}
        self._listeners: set[Callable[[dict[str, Any]], None]] = set()
        self._close_timer: Callable[[], None] | None = None
        self._unsubs: list[Callable[[], None]] = []
        self._tasks: set[asyncio.Task] = set()
        from .zwave import ZWave  # noqa: PLC0415

        self.zwave = ZWave(self)

    # ------------------------------------------------------------ arranque
    @callback
    def start(self) -> None:
        self._unsubs.append(self.hass.bus.async_listen(dr.EVENT_DEVICE_REGISTRY_UPDATED, self._on_device))

    async def async_start_mqtt(self) -> None:
        """Escucha a Zigbee2MQTT (si la casa tiene MQTT)."""
        if "mqtt" not in self.hass.config.components:
            return
        try:
            from homeassistant.components import mqtt  # noqa: PLC0415

            for topic in ("+/bridge/info", "+/bridge/state", "+/bridge/event", "+/bridge/response/permit_join"):
                self._unsubs.append(await mqtt.async_subscribe(self.hass, topic, self._on_mqtt_msg))
        except Exception:  # noqa: BLE001 - sin MQTT andando queda ZHA / Matter / WiFi
            _LOGGER.debug("Alta: no se pudo escuchar Zigbee2MQTT", exc_info=True)

    @callback
    def stop(self) -> None:
        for u in self._unsubs:
            u()
        self._unsubs.clear()
        if self._close_timer:
            self._close_timer()
            self._close_timer = None
        self.zwave._limpiar()  # noqa: SLF001
        for t in self._tasks:
            t.cancel()
        for f in self._waiters:
            if not f.done():
                f.cancel()

    # ------------------------------------------------------------ avisos a la app (cuenta regresiva, estado)
    def snapshot(self) -> dict[str, Any]:
        u = self.union
        return {
            "estado": self.estado,
            "detalle": self.detalle,
            "union": {"abierta": True, "hasta": u["hasta"], "segundos": u["segundos"], "coordinadores": [c["id"] for c in u["coords"]]} if u else {"abierta": False},
            "pendientes": len(self.encontrados),
            "pide_pin": self.zwave.dsk is not None,
            "dsk": self.zwave.dsk,
        }

    @callback
    def subscribe(self, fn: Callable[[dict[str, Any]], None]) -> Callable[[], None]:
        self._listeners.add(fn)
        return lambda: self._listeners.discard(fn)

    @callback
    def _set(self, estado: str, detalle: str = "") -> None:
        self.estado, self.detalle = estado, detalle
        snap = self.snapshot()
        for fn in list(self._listeners):
            try:
                fn(snap)
            except Exception:  # noqa: BLE001 - una pantalla que falla no frena a las demás
                _LOGGER.debug("Alta: aviso a la app falló", exc_info=True)

    # ------------------------------------------------------------ coordinadores
    def detectar_coordinador(self) -> dict[str, Any]:
        coords: list[dict[str, Any]] = []
        for base, info in sorted(self.z2m.items()):
            if info.get("online") is False:
                continue
            coords.append({"id": f"z2m:{base}", "tipo": "z2m", "nombre": "Zigbee2MQTT", "base": base, "version": info.get("version")})
        if self.hass.config_entries.async_entries("zha") and self.hass.services.has_service("zha", "permit"):
            coords.append({"id": "zha", "tipo": "zha", "nombre": "ZHA"})
        zigbee = [c["tipo"] for c in coords]
        if self.zwave.disponible():
            coords.append({"id": "zwave", "tipo": "zwave", "nombre": "Z-Wave"})
        tipos = set(zigbee)
        tipo = "ambos" if len(tipos) > 1 else (next(iter(tipos)) if tipos else "ninguno")  # Zigbee
        return {"tipo": tipo, "zwave": self.zwave.disponible(), "coordinadores": coords}

    # ------------------------------------------------------------ unión
    async def habilitar_union(self, segundos: int | None = None, quien: str = "", red: str = "todas") -> dict[str, Any]:
        n = int(segundos or DEFAULT_UNION)
        n = max(1, min(MAX_UNION, n))
        coords = [c for c in self.detectar_coordinador()["coordinadores"]
                  if red == "todas" or (red == "zwave") == (c["tipo"] == "zwave")]
        if not coords:
            raise AltaError({"zwave": "La casa no tiene Z-Wave andando.",
                             "zigbee": "No encontré un coordinador Zigbee andando en la casa (Zigbee2MQTT o ZHA)."}.get(
                red, "No encontré un coordinador Zigbee ni Z-Wave andando en la casa."))
        ok: list[dict[str, Any]] = []
        errores: list[str] = []
        if self.union:  # se suma a la unión abierta (por ejemplo, Zigbee y después Z-Wave)
            ok = [c for c in self.union["coords"] if c["id"] not in {x["id"] for x in coords}]
        for c in coords:
            try:
                await self._permit(c, n)
                ok.append(c)
            except AltaError as err:
                errores.append(str(err))
        if not ok:
            raise AltaError(errores[0] if errores else "No pude abrir la unión.")
        nueva = self.union is None
        self.union = {"hasta": time.time() + n, "segundos": n, "coords": ok, "quien": quien}
        if nueva:
            self.desde = time.time()
        if self._close_timer:
            self._close_timer()
        self._close_timer = async_call_later(self.hass, n, self._vencio)
        self._audit(f"unión {_red(ok)} habilitada", ", ".join(c["nombre"] for c in ok), quien, f"{n} s")
        if self.estado in ("inactivo", "encontrado"):
            self._set("esperando", "Esperando dispositivo…")
        else:
            self._set(self.estado, self.detalle)
        return {"ok": True, "segundos": n, "hasta": self.union["hasta"], "coordinadores": [c["nombre"] for c in ok], "errores": errores}

    async def deshabilitar_union(self, quien: str = "", motivo: str = "") -> dict[str, Any]:
        if self._close_timer:
            self._close_timer()
            self._close_timer = None
        u, self.union = self.union, None
        coords = u["coords"] if u else self.detectar_coordinador()["coordinadores"]
        for c in coords:
            try:
                await self._permit(c, 0, check=False)
            except AltaError:
                _LOGGER.debug("Alta: no se pudo cerrar la unión en %s", c["id"])
        if u:
            self._audit(f"unión {_red(coords)} cerrada", ", ".join(c["nombre"] for c in coords), quien, motivo)
        if self.estado == "esperando":
            self._set("inactivo")
        else:
            self._set(self.estado, self.detalle)
        return {"ok": True}

    async def _vencio(self, _now=None) -> None:
        self._close_timer = None
        if self.union:
            await self.deshabilitar_union("sistema", "venció el tiempo")

    async def _permit(self, c: dict[str, Any], n: int, check: bool = True) -> None:
        if c["tipo"] == "zwave":
            if n:
                await self.zwave.incluir(n)
            else:
                await self.zwave.parar()
            return
        if c["tipo"] == "zha":
            try:
                await self.hass.services.async_call("zha", "permit", {"duration": n}, blocking=True)
            except Exception as err:  # noqa: BLE001
                raise AltaError("ZHA no aceptó abrir la unión. Revisá que el coordinador esté conectado.") from err
            return
        base = c["base"]
        tid = uuid.uuid4().hex[:12]
        body = {**permit_payload(c.get("version"), n), "transaction": tid}
        fut: asyncio.Future = self.hass.loop.create_future()
        self._resp[tid] = fut
        try:
            await self._publish(f"{base}/bridge/request/permit_join", json.dumps(body))
            if not check:
                return
            try:
                resp = await asyncio.wait_for(fut, RESP_TIMEOUT)
            except TimeoutError:
                _LOGGER.info("Alta: Zigbee2MQTT (%s) no confirmó la unión; se sigue igual", base)
                return
            if isinstance(resp, dict) and resp.get("status") == "error":
                raise AltaError(f"Zigbee2MQTT no aceptó abrir la unión: {resp.get('error') or 'error desconocido'}")
        finally:
            self._resp.pop(tid, None)

    async def _publish(self, topic: str, payload: str) -> None:
        from homeassistant.components import mqtt  # noqa: PLC0415

        try:
            await mqtt.async_publish(self.hass, topic, payload)
        except Exception as err:  # noqa: BLE001
            raise AltaError("No pude hablar con Zigbee2MQTT (MQTT no responde).") from err

    # ------------------------------------------------------------ Zigbee2MQTT
    @callback
    def _on_mqtt_msg(self, msg) -> None:
        self.on_mqtt(str(msg.topic), msg.payload)

    @callback
    def on_mqtt(self, topic: str, raw: Any) -> None:
        base, sep, rest = topic.partition("/bridge/")
        if not sep:
            return
        data = _payload(raw)
        info = self.z2m.setdefault(base, {})
        if rest == "info" and isinstance(data, dict):
            info["version"] = data.get("version")
            info["permit"] = bool(data.get("permit_join"))
            info.setdefault("online", True)
        elif rest == "state":
            st = data.get("state") if isinstance(data, dict) else data
            info["online"] = str(st).lower() == "online"
        elif rest == "response/permit_join" and isinstance(data, dict):
            fut = self._resp.get(str(data.get("transaction") or ""))
            if fut and not fut.done():
                fut.set_result(data)
        elif rest == "event" and isinstance(data, dict):
            self._z2m_event(base, data.get("type"), data.get("data") or {})

    @callback
    def _z2m_event(self, base: str, kind: Any, d: dict[str, Any]) -> None:
        ieee = str(d.get("ieee_address") or "")
        if not ieee:
            return
        name = str(d.get("friendly_name") or ieee)
        if kind == "device_joined":
            self.pendientes[ieee] = {"base": base, "nombre": name, "t": time.time()}
            self._set("uniendo", "Encontré un equipo, se está uniendo…")
        elif kind == "device_interview":
            p = self.pendientes.setdefault(ieee, {"base": base, "nombre": name, "t": time.time()})
            status = d.get("status")
            if status == "started":
                self._set("configurando", "Configurando el equipo…")
            elif status == "successful":
                df = d.get("definition") or {}
                p.update(marca=df.get("vendor"), modelo=df.get("model"), descripcion=df.get("description"),
                         exposes=df.get("exposes") or [], soportado=bool(d.get("supported", True)))
                self._set("configurando", "Configurando el equipo…")
                # si el equipo ya estaba en HA (se volvió a unir), no habrá «creado»: se busca
                dev = self._dev_by_ieee(ieee)
                if dev is not None and dev.id not in self.vistos:
                    self._nuevo(dev.id)
            elif status == "failed":
                self.pendientes.pop(ieee, None)
                self._resolver({"encontrado": False, "error": "configuracion", "nombre": name,
                                "mensaje": "El equipo se unió pero no terminó de configurarse. Resetealo y probá de nuevo, más cerca del coordinador."})
                self._set("esperando" if self.union else "inactivo", "")

    def _dev_by_ieee(self, ieee: str) -> dr.DeviceEntry | None:
        return dr.async_get(self.hass).async_get_device(identifiers={("mqtt", f"zigbee2mqtt_{ieee}")})

    # ------------------------------------------------------------ detección
    @callback
    def _on_device(self, event: Event) -> None:
        if event.data.get("action") != "create":
            return
        self._nuevo(event.data["device_id"])

    @callback
    def _nuevo(self, device_id: str) -> None:
        dev = dr.async_get(self.hass).async_get(device_id)
        if dev is None or dev.entry_type is not None or self._origen(dev) is None:
            return
        now = time.time()
        self.vistos = {k: v for k, v in self.vistos.items() if now - v < RECIENTES}
        self.vistos[device_id] = now
        task = self.hass.async_create_background_task(self._procesar(device_id), f"matterai_alta_{device_id}")
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    def _origen(self, dev: dr.DeviceEntry) -> str | None:
        domains = {e.domain for eid in dev.config_entries if (e := self.hass.config_entries.async_get_entry(eid))}
        if domains & IGNORAR_DOMINIOS:
            return None
        if "zha" in domains:
            return "zha"
        if "zwave_js" in domains:
            return "zwave"
        if "matter" in domains:
            return "matter"
        if z2m_ieee(dev):
            return "z2m"
        if "mqtt" in domains and any(str(i).startswith("zigbee2mqtt_bridge") for _, i in dev.identifiers):
            return None  # el puente de Zigbee2MQTT
        return next(iter(sorted(domains)), None) or None

    async def _procesar(self, device_id: str) -> None:
        if self.union or self._waiters:
            self._set("configurando", "Configurando el equipo…")
        await self._esperar_entidades(device_id)
        item = self.info(device_id)
        if item is None:
            return
        if item["tipo"] == "desconocido" and not item["entidades_total"]:
            return  # algo sin entidades (un hub vacío, un servicio): no es un equipo para mostrar
        item["encontrado"] = True
        self._audit("dispositivo nuevo", item["nombre"], "", " ".join(x for x in (item.get("marca"), item.get("modelo"), f"({item['origen']})") if x))
        if not self.desde:
            desc = (self.hass.data.get(DOMAIN) or {}).get("descubrimientos")
            if desc is not None:
                desc.agregar_equipo(item)  # fuera de una sesión de alta: va a la campanita
            return
        self.encontrados = [*self.encontrados, item][-20:]
        self._resolver(None)
        self._set("encontrado", f"Encontré: {item['tipo_texto']}")

    async def _esperar_entidades(self, device_id: str) -> None:
        reg = er.async_get(self.hass)
        start = last_change = time.monotonic()
        last = -1
        while time.monotonic() - start < MAX_SETTLE:
            n = len(er.async_entries_for_device(reg, device_id, include_disabled_entities=True))
            now = time.monotonic()
            if n != last:
                last, last_change = n, now
            elif n > 0 and now - last_change >= SETTLE:
                return
            await asyncio.sleep(POLL)

    @callback
    def _resolver(self, fallo: dict[str, Any] | None) -> None:
        """Le da el próximo equipo (o el error) al primero que esté esperando."""
        while self._waiters:
            f = self._waiters.pop(0)
            if f.done():
                continue
            if fallo is not None:
                f.set_result(fallo)
            elif self.encontrados:
                f.set_result(self.encontrados.pop(0))
            else:
                self._waiters.insert(0, f)
            return

    async def esperar_dispositivo_nuevo(self, timeout: float = 120) -> dict[str, Any]:
        timeout = max(1.0, min(float(timeout), MAX_ESPERA))
        if not self.desde:
            self.desde = time.time()
        if self.encontrados:
            return self._tomar(self.encontrados.pop(0))
        fut: asyncio.Future = self.hass.loop.create_future()
        self._waiters.append(fut)
        if self.estado == "inactivo":
            self._set("esperando", "Esperando dispositivo…")
        try:
            return self._tomar(await asyncio.wait_for(fut, timeout))
        except TimeoutError:
            if self.estado == "esperando" and not self.union:
                self._set("inactivo")
            return {"encontrado": False, "error": "tiempo", "mensaje": "No apareció ningún equipo nuevo todavía."}
        finally:
            if fut in self._waiters:
                self._waiters.remove(fut)

    def _tomar(self, item: dict[str, Any]) -> dict[str, Any]:
        if item.get("encontrado") and item.get("device_id"):
            self.sesion.append(item["device_id"])
            fresh = self.info(item["device_id"])  # puede haber sumado entidades mientras esperaba
            if fresh:
                item = {**fresh, "encontrado": True}
        return item

    @callback
    def iniciar(self) -> None:
        """Empieza una sesión sin unión Zigbee (Matter, WiFi): cuentan los equipos que aparezcan desde ahora."""
        self.desde = time.time()
        self.encontrados.clear()

    @callback
    def terminar(self) -> None:
        self.desde = 0.0
        self.encontrados.clear()
        self.pendientes.clear()
        self._set("inactivo")

    # ------------------------------------------------------------ qué es
    def info(self, device_id: str) -> dict[str, Any] | None:
        """capacidades(device_id): marca, modelo, tipo normalizado, funciones, área."""
        dev = dr.async_get(self.hass).async_get(device_id)
        if dev is None:
            return None
        ents = er.async_entries_for_device(er.async_get(self.hass), device_id, include_disabled_entities=False)
        rows = []
        for e in ents:
            st = self.hass.states.get(e.entity_id)
            rows.append({"entity_id": e.entity_id, "device_class": e.device_class or e.original_device_class or (st.attributes.get("device_class") if st else None),
                         "attrs": dict(st.attributes) if st else {}, "tecnica": e.entity_category is not None})
        ieee = z2m_ieee(dev)
        z = self.pendientes.get(ieee or "") or {}
        cap = normalizar(rows, z.get("exposes"))
        area = ar.async_get(self.hass).async_get_area(dev.area_id) if dev.area_id else None
        origen = self._origen(dev) or ""
        return {
            "device_id": device_id,
            "nombre": dev.name_by_user or dev.name or z.get("nombre") or "Equipo nuevo",
            "marca": z.get("marca") or dev.manufacturer,
            "modelo": z.get("modelo") or dev.model,
            "descripcion": z.get("descripcion"),
            "origen": origen,
            "ieee": ieee or zha_ieee(dev),
            "area_id": dev.area_id,
            "area": area.name if area else None,
            "entidades_total": len(rows),
            **cap,
            "nombre_sugerido": nombre_sugerido(cap["tipo"], area.name if area else None),
        }

    # ------------------------------------------------------------ área y nombre
    def listar_areas(self) -> list[dict[str, Any]]:
        pisos: dict[str, str] = {}
        try:
            from homeassistant.helpers import floor_registry as fr  # noqa: PLC0415

            pisos = {f.floor_id: f.name for f in fr.async_get(self.hass).async_list_floors()}
        except ImportError:  # HA sin pisos
            pass
        out = [{"area_id": x.id, "nombre": x.name, "piso": pisos.get(getattr(x, "floor_id", None) or "")}
               for x in ar.async_get(self.hass).async_list_areas()]
        return sorted(out, key=lambda x: ((x["piso"] or ""), x["nombre"].lower()))

    async def asignar_area(self, device_id: str, area_id: str | None, area_nueva: str | None, quien: str = "") -> dict[str, Any]:
        devs, areas = dr.async_get(self.hass), ar.async_get(self.hass)
        if devs.async_get(device_id) is None:
            raise AltaError("No encuentro ese equipo.")
        area = areas.async_get_area(area_id) if area_id else None
        if area is None and area_nueva and area_nueva.strip():
            nombre = " ".join(area_nueva.split())[:40]
            area = areas.async_get_area_by_name(nombre) or areas.async_create(nombre)
            self._audit("ambiente creado", nombre, quien)
        if area is None:
            raise AltaError("No encuentro ese ambiente. Elegí uno de la lista o decime cómo se llama el nuevo.")
        devs.async_update_device(device_id, area_id=area.id)
        dev = devs.async_get(device_id)
        self._audit("área asignada", dev.name_by_user or dev.name or device_id, quien, area.name)
        info = self.info(device_id) or {}
        return {"area_id": area.id, "area": area.name, "nombre_sugerido": info.get("nombre_sugerido")}

    async def renombrar(self, device_id: str, nombre: str, quien: str = "") -> dict[str, Any]:
        nombre = " ".join(str(nombre).split())[:50]
        if len(nombre) < 2:
            raise AltaError("Decime un nombre para el equipo.")
        devs, reg = dr.async_get(self.hass), er.async_get(self.hass)
        dev = devs.async_get(device_id)
        if dev is None:
            raise AltaError("No encuentro ese equipo.")
        nuevo = device_id in self.vistos  # recién agregado: también se ordenan los entity_id
        info = self.info(device_id) or {}
        principal = set((info.get("entidades") or {}).get(info.get("tipo"), [])[:1])
        devs.async_update_device(device_id, name_by_user=nombre)
        usados: dict[str, int] = {}
        renombradas = []
        for e in er.async_entries_for_device(reg, device_id, include_disabled_entities=True):
            dc = e.device_class or e.original_device_class
            tecnica = e.entity_category is not None
            if tecnica and dc != "battery":
                continue
            suf = "" if e.entity_id in principal else sufijo(e.entity_id, dc)
            ent_name = f"{nombre} {suf}".strip()
            n = usados.get(ent_name, 0)
            usados[ent_name] = n + 1
            if n:
                ent_name = f"{ent_name} {n + 1}"
            changes: dict[str, Any] = {"name": ent_name}
            if nuevo:
                from homeassistant.util import slugify  # noqa: PLC0415

                domain = e.entity_id.split(".")[0]
                want = f"{domain}.{slugify(ent_name)}"
                if want != e.entity_id:
                    changes["new_entity_id"] = reg.async_generate_entity_id(domain, slugify(ent_name))
            reg.async_update_entity(e.entity_id, **changes)
            renombradas.append(changes.get("new_entity_id") or e.entity_id)
        self._audit("renombrado", nombre, quien, dev.name_by_user or dev.name or "")
        return {"nombre": nombre, "entidades": renombradas}

    async def cerrar_sesion(self, quien: str = "") -> dict[str, Any]:
        if self.union:
            await self.deshabilitar_union(quien, "terminó el alta")
        hechos = [i for d in dict.fromkeys(self.sesion) if (i := self.info(d))]
        resumen = [{"device_id": i["device_id"], "nombre": i["nombre"], "tipo": i["tipo_texto"], "area": i["area"]} for i in hechos]
        if resumen:
            self._audit("alta terminada", f"{len(resumen)} equipo{'s' if len(resumen) != 1 else ''}", quien,
                        "; ".join(f"{r['nombre']} ({r['area'] or 'sin ambiente'})" for r in resumen))
        self.sesion.clear()
        self.terminar()
        return {"agregados": resumen}

    # ------------------------------------------------------------ quitar (un equipo que el cliente no reconoce)
    async def quitar(self, device_id: str, quien: str = "") -> dict[str, Any]:
        dev = dr.async_get(self.hass).async_get(device_id)
        if dev is None:
            raise AltaError("Ese equipo ya no está.")
        name = dev.name_by_user or dev.name or device_id
        if (ieee := z2m_ieee(dev)) is not None:
            base = (self.pendientes.get(ieee) or {}).get("base") or next(iter(self.z2m), "zigbee2mqtt")
            await self._publish(f"{base}/bridge/request/device/remove", json.dumps({"id": ieee}))
        elif (ieee := zha_ieee(dev)) is not None and self.hass.services.has_service("zha", "remove"):
            await self.hass.services.async_call("zha", "remove", {"ieee": ieee}, blocking=True)
        else:
            raise AltaError("Este equipo no se puede quitar desde acá: hay que borrarlo desde su integración.")
        self.encontrados = [x for x in self.encontrados if x["device_id"] != device_id]
        self._audit("dispositivo quitado", name, quien)
        return {"ok": True}

    # ------------------------------------------------------------ auditoría
    @callback
    def _audit(self, what: str, target: str = "", who: str = "", detail: str = "") -> None:
        from ..audit import log  # noqa: PLC0415

        log(self.hass, "alta", what, target, who, detail)


# ---------------------------------------------------------------- permisos
def es_invitado(hass: HomeAssistant, user_id: str) -> bool:
    house = (hass.data.get(DOMAIN) or {}).get("house")
    d = (house.devices.get(user_id) if house is not None else None) or {}
    return bool(d.get("until")) or d.get("via") == "guest"


def puede_agregar(hass: HomeAssistant, user) -> bool:
    """El titular (un celular de la casa con perfil «Completo», que no sea invitado) o el instalador."""
    if user is None:
        return False
    if user.is_admin:
        return True
    rt = hass.data.get(DOMAIN) or {}
    house, ad = rt.get("house"), rt.get("app_devices")
    if house is None or not house.is_device_user(user.id) or es_invitado(hass, user.id):
        return False
    if house.device_profile(user.id) not in (None, "full"):
        return False
    if ad is None:
        return True
    from ..app_devices import app_entries  # noqa: PLC0415

    mine = [e.data.get("device_id") for e in app_entries(hass) if e.data.get("user_id") == user.id]
    return all(ad.profile(d)["profile"] == "full" for d in mine if d)


async def quien(hass: HomeAssistant, user) -> str:
    a = (hass.data.get(DOMAIN) or {}).get("audit")
    if a is None or user is None:
        return "sistema"
    return await a._who(user.id)  # noqa: SLF001
