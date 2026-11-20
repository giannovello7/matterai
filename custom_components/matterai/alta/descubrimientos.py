"""Lo que la casa encuentra sola → la campanita de la app (sólo el titular y el instalador).

- Descubrimientos de HA (los «Descubiertos» de Integraciones: Shelly, Chromecast, impresoras…).
- Equipos que entran al registro sin ambiente fuera de una sesión de alta (un Zigbee unido desde otro lado).

Una entrada por equipo (sin duplicados), que se borra sola cuando se agrega o se ignora desde cualquier lado (la app o
HA). Acciones: agregar (sigue el alta: ambiente, nombre, automatizaciones), ignorar (el ignorar nativo de HA, se
recupera desde Integraciones → Ignoradas) o más tarde (queda en la lista sin contar en el numerito).
Avisos al celular opcionales (cada equipo de la app lo activa), agrupados si aparecen varios juntos.
"""

from __future__ import annotations

from collections.abc import Callable
import logging
import time
from typing import Any

from homeassistant import config_entries
from homeassistant.core import Event, HomeAssistant, callback
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.event import async_call_later
from homeassistant.helpers.storage import Store

from ..const import DOMAIN
from .core import AltaError

_LOGGER = logging.getLogger(__name__)

STORAGE_KEY = f"{DOMAIN}.descubrimientos"
FUENTES = {
    config_entries.SOURCE_BLUETOOTH, config_entries.SOURCE_DHCP, config_entries.SOURCE_DISCOVERY, config_entries.SOURCE_HASSIO,
    config_entries.SOURCE_HOMEKIT, config_entries.SOURCE_INTEGRATION_DISCOVERY, config_entries.SOURCE_MQTT,
    config_entries.SOURCE_SSDP, config_entries.SOURCE_USB, config_entries.SOURCE_ZEROCONF,
}
AGRUPAR_S = 10.0  # los que aparecen juntos van en un solo aviso
MAX_SIN_AREA = 50


ETIQUETAS = {
    "password": "Contraseña", "username": "Usuario", "pairing_code": "Código de HomeKit (8 números)", "noise_psk": "Clave de encriptación",
    "api_key": "Clave de acceso", "pin": "PIN", "code": "Código", "host": "Dirección", "port": "Puerto", "token": "Clave de acceso",
}
MOTIVOS = {"already_configured": "ya estaba agregado", "cannot_connect": "no se pudo conectar", "already_in_progress": "ya se está agregando",
           "not_supported": "este equipo no se puede agregar así", "unknown": "error desconocido"}


def campos_de(schema: Any) -> list[dict[str, Any]]:
    """Los campos de un formulario de HA, simples y en castellano (texto, número, sí/no, opciones)."""
    if schema is None:
        return []
    import voluptuous as vol  # noqa: PLC0415

    out = []
    for key, val in getattr(schema, "schema", {}).items():
        nombre = str(getattr(key, "schema", key))
        tipo = "si_no" if val is bool else "numero" if val in (int, float) else "opciones" if isinstance(val, vol.In) else "texto"
        campo = {"nombre": nombre, "etiqueta": ETIQUETAS.get(nombre, nombre.replace("_", " ").capitalize()), "tipo": tipo,
                 "requerido": isinstance(key, vol.Required), "secreto": nombre in ("password", "pairing_code", "noise_psk", "api_key", "pin", "token", "code")}
        if tipo == "opciones":
            campo["opciones"] = [str(x) for x in (val.container or [])]
        out.append(campo)
    return out


def _errores(errors: Any) -> dict[str, str]:
    txt = {"invalid_auth": "datos incorrectos", "authentication_error": "datos incorrectos", "cannot_connect": "no se pudo conectar",
           "invalid_psk": "la clave no es correcta", "unknown": "error desconocido"}
    return {str(k): txt.get(str(v), str(v).replace("_", " ")) for k, v in (errors or {}).items()}


def _motivo(reason: Any) -> str:
    return MOTIVOS.get(str(reason or ""), str(reason or "cancelado").replace("_", " "))


class Descubrimientos:
    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store: Store = Store(hass, 1, STORAGE_KEY)
        self.sin_area: dict[str, dict[str, Any]] = {}  # device_id → {titulo, marca, modelo, t}
        self.luego: dict[str, float] = {}  # clave → cuándo se dejó para más tarde
        self.ignorados: set[str] = set()  # equipos sin ambiente ignorados (los flujos se ignoran en HA)
        self.push: dict[str, bool] = {}  # device_id de la app → quiere avisos al celular
        self.vistos: set[str] = set()  # claves ya avisadas
        self._nombres: dict[str, str] = {}
        self._listeners: set[Callable[[list[dict[str, Any]]], None]] = set()
        self._unsubs: list[Callable[[], None]] = []
        self._nuevos: list[dict[str, Any]] = []
        self._timer: Callable[[], None] | None = None
        self._ultima: list[dict[str, Any]] = []

    async def async_load(self) -> None:
        data = await self._store.async_load() or {}
        self.sin_area = data.get("sin_area") or {}
        self.luego = data.get("luego") or {}
        self.ignorados = set(data.get("ignorados") or [])
        self.push = data.get("push") or {}
        self.vistos = set(data.get("vistos") or [])

    def _save(self) -> None:
        self._store.async_delay_save(lambda: {"sin_area": self.sin_area, "luego": self.luego, "ignorados": sorted(self.ignorados),
                                              "push": self.push, "vistos": sorted(self.vistos)[-500:]}, 5)

    @callback
    def start(self) -> None:
        flow = self.hass.config_entries.flow
        if hasattr(flow, "async_subscribe_flow"):  # HA nuevo: cada flujo que empieza o termina
            self._unsubs.append(flow.async_subscribe_flow(self._cambio_args))
        self._unsubs.append(self.hass.bus.async_listen(config_entries.EVENT_FLOW_DISCOVERED, self._cambio_args))
        self._unsubs.append(async_dispatcher_connect(self.hass, config_entries.SIGNAL_CONFIG_ENTRY_CHANGED, self._cambio_args))
        self._unsubs.append(self.hass.bus.async_listen(dr.EVENT_DEVICE_REGISTRY_UPDATED, self._on_device))
        self._cambio()

    @callback
    def stop(self) -> None:
        for u in self._unsubs:
            u()
        self._unsubs.clear()
        if self._timer:
            self._timer()
            self._timer = None

    # ------------------------------------------------------------ lista
    def _flows(self) -> list[dict[str, Any]]:
        out, keys = [], set()
        for f in self.hass.config_entries.flow.async_progress():
            ctx = f.get("context") or {}
            if ctx.get("source") not in FUENTES or f.get("handler") == DOMAIN:
                continue
            key = f"flow:{f['handler']}:{ctx.get('unique_id') or f['flow_id']}"
            if key in keys:
                continue  # el mismo equipo encontrado por dos caminos
            keys.add(key)
            ph = ctx.get("title_placeholders") or {}
            integ = self._integracion(f["handler"])
            nombre = str(ph.get("name") or ph.get("model") or integ)
            out.append({"id": key, "flow_id": f["flow_id"], "tipo": "descubierto", "integracion": integ, "titulo": nombre,
                        "texto": f"Se encontró {('un ' + integ) if nombre == integ else nombre} en la red",
                        "unique_id": ctx.get("unique_id"), "handler": f["handler"]})
        return out

    def _integracion(self, handler: str) -> str:
        return self._nombres.get(handler) or handler.replace("_", " ").title()

    async def _cargar_nombres(self, handlers: set[str]) -> None:
        from homeassistant.loader import async_get_integration  # noqa: PLC0415

        for h in handlers - set(self._nombres):
            try:
                self._nombres[h] = (await async_get_integration(self.hass, h)).name
            except Exception:  # noqa: BLE001 - integración rara: queda el nombre del dominio
                self._nombres[h] = h.replace("_", " ").title()

    def listar(self) -> list[dict[str, Any]]:
        items = self._flows()
        devs = dr.async_get(self.hass)
        for did, d in list(self.sin_area.items()):
            dev = devs.async_get(did)
            if dev is None or dev.area_id or did in self.ignorados:
                self.sin_area.pop(did, None)
                continue
            items.append({"id": f"dev:{did}", "device_id": did, "tipo": "sin_area", "titulo": dev.name_by_user or dev.name or d.get("titulo") or "Equipo nuevo",
                          "marca": dev.manufacturer, "modelo": dev.model, "texto": f"Se agregó {d.get('tipo_texto') or 'un equipo'} sin ambiente"})
        for it in items:
            it["luego"] = it["id"] in self.luego
        vivos = {it["id"] for it in items}
        self.luego = {k: v for k, v in self.luego.items() if k in vivos}
        return items

    @callback
    def _cambio_args(self, *_args: Any) -> None:
        self._cambio()

    @callback
    def _cambio(self) -> None:
        handlers = {f.get("handler") for f in self.hass.config_entries.flow.async_progress()} - {None}
        if handlers - set(self._nombres):
            self.hass.async_create_background_task(self._nombres_y_cambio(handlers), "matterai_descubrimientos")
            return
        items = self.listar()
        nuevos = [it for it in items if it["id"] not in self.vistos]
        if nuevos:
            self.vistos |= {it["id"] for it in nuevos}
            self._save()
            self._nuevos += nuevos
            if self._timer is None:
                self._timer = async_call_later(self.hass, AGRUPAR_S, self._avisar)
        if [i["id"] for i in items] != [i["id"] for i in self._ultima] or any(a != b for a, b in zip(items, self._ultima)):
            self._ultima = items
            for fn in list(self._listeners):
                fn(items)

    async def _nombres_y_cambio(self, handlers: set[str]) -> None:
        await self._cargar_nombres(handlers)
        self._cambio()

    @callback
    def subscribe(self, fn: Callable[[list[dict[str, Any]]], None]) -> Callable[[], None]:
        self._listeners.add(fn)
        return lambda: self._listeners.discard(fn)

    # ------------------------------------------------------------ equipos sin ambiente
    @callback
    def agregar_equipo(self, item: dict[str, Any]) -> None:
        """Un equipo que entró fuera de una sesión de alta (lo llama Alta)."""
        if item.get("area_id") or item["device_id"] in self.ignorados:
            return
        self.sin_area[item["device_id"]] = {"titulo": item.get("nombre"), "tipo_texto": item.get("tipo_texto"), "t": time.time()}
        while len(self.sin_area) > MAX_SIN_AREA:
            self.sin_area.pop(min(self.sin_area, key=lambda k: self.sin_area[k].get("t", 0)))
        self._save()
        self._cambio()

    @callback
    def _on_device(self, event: Event) -> None:
        did = event.data.get("device_id")
        if did in self.sin_area and (event.data.get("action") == "remove" or "area_id" in (event.data.get("changes") or {})):
            self._cambio()

    # ------------------------------------------------------------ avisos al celular
    async def _avisar(self, _now=None) -> None:
        self._timer = None
        nuevos, self._nuevos = self._nuevos, []
        if not nuevos:
            return
        msg = nuevos[0]["texto"] + "." if len(nuevos) == 1 else f"Se encontraron {len(nuevos)} dispositivos nuevos."
        from ..app_devices import app_entries  # noqa: PLC0415
        from homeassistant.util import slugify  # noqa: PLC0415

        for e in app_entries(self.hass):
            if not self.push.get(e.data.get("device_id") or ""):
                continue
            target = f"mobile_app_{slugify(e.data.get('device_name') or '')}"
            if not self.hass.services.has_service("notify", target):
                continue
            try:
                await self.hass.services.async_call("notify", target, {"title": "Equipos nuevos", "message": msg + " Tocá para agregarlo.",
                                                                       "data": {"url": "/?alta=descubiertos", "tag": "matterai-descubiertos"}}, blocking=False)
            except Exception:  # noqa: BLE001 - un aviso que no sale no rompe nada
                _LOGGER.debug("Descubrimientos: no salió el aviso a %s", target, exc_info=True)

    def set_push(self, device_id: str, on: bool) -> None:
        self.push[device_id] = bool(on)
        self._save()

    # ------------------------------------------------------------ acciones
    def _item(self, item_id: str) -> dict[str, Any]:
        it = next((x for x in self.listar() if x["id"] == item_id), None)
        if it is None:
            raise AltaError("Ese equipo ya no está en la lista (puede que lo hayan agregado o ignorado desde otro lado).")
        return it

    async def ignorar(self, item_id: str, quien: str) -> dict[str, Any]:
        it = self._item(item_id)
        if it["tipo"] == "sin_area":
            self.ignorados.add(it["device_id"])
            self.sin_area.pop(it["device_id"], None)
        else:
            if not it.get("unique_id"):
                raise AltaError("Este equipo no se puede ignorar; podés dejarlo para más tarde.")
            flow = next((f for f in self.hass.config_entries.flow.async_progress() if f["flow_id"] == it["flow_id"]), None)
            context: dict[str, Any] = {"source": config_entries.SOURCE_IGNORE}
            if flow and "discovery_key" in (flow.get("context") or {}):
                context["discovery_key"] = flow["context"]["discovery_key"]
            # lo mismo que «Ignorar» en Integraciones (config_entries/ignore_flow): se recupera desde ahí
            await self.hass.config_entries.flow.async_init(it["handler"], context=context, data={"unique_id": it["unique_id"], "title": it["titulo"]})
        self._audit("descubrimiento ignorado", it["titulo"], quien, it.get("integracion") or "")
        self._save()
        self._cambio()
        return {"ok": True}

    def mas_tarde(self, item_id: str) -> dict[str, Any]:
        self._item(item_id)
        self.luego[item_id] = time.time()
        self._save()
        self._cambio()
        return {"ok": True}

    async def agregar(self, item_id: str, quien: str, datos: dict[str, Any] | None = None) -> dict[str, Any]:
        """Confirma el descubrimiento en HA. Si el equipo pide datos (código de HomeKit, clave de ESPHome, contraseña),
        devuelve qué campos y se vuelve a llamar con `datos`. Los datos no se guardan ni van a los logs."""
        it = self._item(item_id)
        if it["tipo"] == "sin_area":
            self.luego.pop(item_id, None)
            self._audit("descubrimiento agregado", it["titulo"], quien, "equipo sin ambiente")
            return {"ok": True, "device_id": it["device_id"], "mensaje": "Seguí con el ambiente y el nombre."}
        from homeassistant import data_entry_flow  # noqa: PLC0415
        import voluptuous as vol  # noqa: PLC0415

        flow = self.hass.config_entries.flow
        datos = {str(k): v for k, v in (datos or {}).items() if isinstance(v, (str, int, float, bool))}
        try:
            for _ in range(4):  # flujos de varios pasos (confirmar → código → listo)
                actual = await flow.async_configure(it["flow_id"])  # el paso en el que está, sin mandar nada
                if str(actual.get("type")).endswith("form"):
                    campos = campos_de(actual.get("data_schema"))
                    if campos and not datos:
                        return {"ok": False, "pide_datos": True, "id": item_id, "campos": campos, "paso": actual.get("step_id"),
                                "errores": _errores(actual.get("errors")),
                                "mensaje": "Para conectarlo hacen falta estos datos: " + ", ".join(c["etiqueta"] for c in campos) + "."}
                    enviar = {c["nombre"]: datos[c["nombre"]] for c in campos if c["nombre"] in datos}
                    datos = {}
                    res = await flow.async_configure(it["flow_id"], enviar)
                else:
                    res = actual
                tipo = str(res.get("type"))
                if tipo.endswith("create_entry"):
                    self._audit("descubrimiento agregado", it["titulo"], quien, it.get("integracion") or "")
                    self._cambio()
                    return {"ok": True, "agregado": True, "mensaje": "Listo, quedó agregado. Ahora vemos qué es."}
                if tipo.endswith("abort"):
                    self._cambio()
                    raise AltaError(f"No se pudo agregar ({_motivo(res.get('reason'))}).")
                if tipo.endswith("form") and res.get("errors"):
                    return {"ok": False, "pide_datos": True, "id": item_id, "campos": campos_de(res.get("data_schema")), "paso": res.get("step_id"),
                            "errores": _errores(res.get("errors")), "mensaje": "Esos datos no funcionaron. Revisalos y probá de nuevo."}
                if not tipo.endswith("form"):
                    break
        except (data_entry_flow.UnknownFlow, data_entry_flow.UnknownStep):
            raise AltaError("Ese equipo ya no está esperando (puede que lo hayan agregado desde otro lado).") from None
        except (vol.Invalid, data_entry_flow.InvalidData, ValueError):
            return {"ok": False, "pide_datos": True, "id": item_id, "campos": [], "mensaje": "Esos datos no tienen el formato que espera el equipo."}
        return {"ok": False, "necesita_datos": True, "error": "Este equipo pide pasos que la app no sabe hacer. Lo termina tu instalador."}

    def _audit(self, what: str, target: str, who: str, detail: str = "") -> None:
        from ..audit import log  # noqa: PLC0415

        log(self.hass, "alta", what, target, who, detail)
