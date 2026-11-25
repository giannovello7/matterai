"""Los avisos de las automatizaciones quedan en la campanita de la app, con la foto del momento.

- Todo aviso que manda una automatización (las máquinas de estados de escenas/ y las reglas armadas a mano o por Matte
  con «Enviar una notificación») se anota acá, además de salir al celular.
- Quién lo ve: los equipos a los que se mandó y los demás equipos de esa misma persona (los que tienen su mismo
  dashboard). Si era para todos, todos los de la casa menos los invitados. Un administrador que no vive en la casa
  (el instalador) no los ve.
- Foto: se saca una sola vez, cuando pasa, y se guarda en <config>/matterai_avisos/ (nunca en /local). Sólo la puede
  pedir quien ve el aviso (GET /api/matterai/aviso/<id>.jpg con usuario o link firmado) y cuyo perfil deje ver cámaras.
  El aviso sale al celular sin esperarla: quien la pide antes de que esté lista espera unos segundos.
- Límites: 200 avisos y 30 días. Cada persona borra los suyos; cuando ya no lo ve nadie se borra con su foto.
"""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from datetime import timedelta
import io
import logging
import os
import re
import time
import uuid
from typing import Any

from aiohttp import web
import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.components.http import HomeAssistantView
from homeassistant.core import HomeAssistant, ServiceCall, callback
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.helpers.storage import Store
from homeassistant.util import slugify

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

STORAGE_KEY = f"{DOMAIN}.avisos"
DIR = "matterai_avisos"
MAX_AVISOS = 200
MAX_DIAS = 30
JUNTAR_S = 60           # el mismo aviso a varios celulares (o repetido enseguida) es uno solo
JUNTAR_REPITE_S = 3600  # recordatorios y «sigue abierta»: no llenan la campanita
FOTO_S = 8              # cuánto se espera a la cámara
FOTO_PX = 1280
NAME_RE = re.compile(r"^([a-f0-9]{32})\.jpg$")
EVENT_RE = re.compile(r"^[0-9.]+-[A-Za-z0-9]+$")
SERVICE = "aviso"
URL = "/api/matterai/aviso/"


def _rt(hass: HomeAssistant) -> dict[str, Any]:
    return hass.data.get(DOMAIN) or {}


# ---------------------------------------------------------------- cámaras
@callback
def camara_de(hass: HomeAssistant, entity_id: str | None) -> str | None:
    """La cámara del mismo aparato que un sensor (el «auto» de Frigate, el movimiento de una cámara, un portero)."""
    if not entity_id or not isinstance(entity_id, str):
        return None
    if entity_id.startswith("camera."):
        return entity_id if hass.states.get(entity_id) else None
    reg = er.async_get(hass)
    ent = reg.async_get(entity_id)
    if ent is None or not ent.device_id:
        return None
    cams = sorted(e.entity_id for e in er.async_entries_for_device(reg, ent.device_id) if e.domain == "camera" and hass.states.get(e.entity_id))
    return cams[0] if cams else None


@callback
def area_de(hass: HomeAssistant, entity_id: str) -> str | None:
    ent = er.async_get(hass).async_get(entity_id)
    if ent is None:
        return None
    dev = dr.async_get(hass).async_get(ent.device_id) if ent.device_id else None
    return ent.area_id or (dev.area_id if dev else None)


@callback
def elegir_camara(hass: HomeAssistant, sensores: list[str]) -> str | None:
    """Para Matte: la cámara del aparato que dispara o, si no, la única del mismo ambiente."""
    for s in sensores:
        cam = camara_de(hass, s)
        if cam:
            return cam
    for s in sensores:
        st = hass.states.get(s)
        dc = st.attributes.get("device_class") if st else None
        area = area_de(hass, s)
        if area and (s.startswith("event.") or dc in ("motion", "occupancy", "presence")):
            cams = [c.entity_id for c in hass.states.async_all("camera") if area_de(hass, c.entity_id) == area]
            if len(cams) == 1:
                return cams[0]
    return None


def _achicar(data: bytes) -> bytes | None:
    """Siempre JPG y de tamaño razonable (queda en la casa y viaja al celular)."""
    try:
        from PIL import Image  # noqa: PLC0415

        im = Image.open(io.BytesIO(data))
        im.thumbnail((FOTO_PX, FOTO_PX))
        out = io.BytesIO()
        im.convert("RGB").save(out, "JPEG", quality=82)
        return out.getvalue()
    except Exception:  # noqa: BLE001 - sin Pillow o imagen rara: sólo si ya es un JPG
        return data if data[:3] == b"\xff\xd8\xff" else None


class Avisos:
    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store: Store[dict[str, Any]] = Store(hass, 1, STORAGE_KEY, private=True)
        self.items: list[dict[str, Any]] = []  # el más nuevo primero
        self.sacando: dict[str, asyncio.Task] = {}
        self._listeners: set[Callable[[], None]] = set()
        self._unsub: Callable[[], None] | None = None

    # ------------------------------------------------------------ guardado
    async def async_load(self) -> None:
        data = await self._store.async_load() or {}
        self.items = [a for a in data.get("avisos") or [] if isinstance(a, dict) and a.get("id")]
        ids = {a["id"] for a in self.items}

        def _sueltas() -> None:  # fotos sin aviso (por ejemplo, un corte de luz antes de guardar)
            if os.path.isdir(self.dir):
                for n in os.listdir(self.dir):
                    m = NAME_RE.match(n)
                    if m and m.group(1) not in ids:
                        os.remove(os.path.join(self.dir, n))

        await self.hass.async_add_executor_job(_sueltas)
        self.vencer()

    @callback
    def start(self) -> None:
        self._unsub = async_track_time_interval(self.hass, self._vencer_timer, timedelta(hours=6))
        self.hass.services.async_register(DOMAIN, SERVICE, self._servicio, schema=vol.Schema({
            vol.Required("notify"): cv.string, vol.Required("message"): cv.string, vol.Optional("title"): vol.Any(None, cv.string),
            vol.Optional("data"): vol.Any(None, dict), vol.Optional("rule_id", default=""): cv.string, vol.Optional("rule", default=""): cv.string,
            vol.Optional("sensor"): vol.Any(None, cv.string), vol.Optional("foto"): vol.Any(None, cv.string),
        }))

    async def async_stop(self) -> None:
        if self._unsub:
            self._unsub()
            self._unsub = None
        for t in list(self.sacando.values()):
            t.cancel()
        self.hass.services.async_remove(DOMAIN, SERVICE)
        await self._store.async_save(self._datos())

    @property
    def dir(self) -> str:
        return self.hass.config.path(DIR)

    def ruta(self, aid: str) -> str:
        return os.path.join(self.dir, f"{aid}.jpg")

    def _datos(self) -> dict[str, Any]:
        return {"avisos": self.items}

    @callback
    def _cambio(self) -> None:
        self._store.async_delay_save(self._datos, 1)
        for fn in list(self._listeners):
            fn()

    @callback
    def subscribe(self, fn: Callable[[], None]) -> Callable[[], None]:
        self._listeners.add(fn)
        return lambda: self._listeners.discard(fn)

    @callback
    def _sacar(self, fuera: list[dict[str, Any]]) -> None:
        if not fuera:
            return
        ids = {a["id"] for a in fuera}
        self.items = [a for a in self.items if a["id"] not in ids]

        def _rm() -> None:
            for aid in ids:
                try:
                    os.remove(self.ruta(aid))
                except OSError:
                    pass

        self.hass.async_add_executor_job(_rm)  # si la foto todavía se está sacando, _foto ve que ya no está el aviso y la borra

    @callback
    def _vencer_timer(self, _now: Any) -> None:
        self.vencer()

    @callback
    def vencer(self) -> None:
        limite = time.time() - MAX_DIAS * 86400
        fuera = [a for i, a in enumerate(self.items) if i >= MAX_AVISOS or a["t"] < limite]
        if fuera:
            self._sacar(fuera)
            self._cambio()

    # ------------------------------------------------------------ quién lo ve
    def _invitado(self, uid: str) -> bool:
        from .alta.core import es_invitado  # noqa: PLC0415

        return es_invitado(self.hass, uid)

    @callback
    def persona(self, uid: str) -> set[str]:
        """Todos los usuarios (cada equipo tiene el suyo) de la misma persona: los que tienen su mismo dashboard."""
        out, v = {uid}, _rt(self.hass).get("views")
        if v is None or self._invitado(uid):
            return out
        from .app_devices import app_entries  # noqa: PLC0415

        de = dict(v.users)
        for e in app_entries(self.hass):
            vid = v.assign.get(e.data.get("device_id") or "")
            if vid and e.data.get("user_id"):
                de[e.data["user_id"]] = vid
        mio = de.get(uid)
        if mio:
            out |= {u for u, vid in de.items() if vid == mio and not self._invitado(u)}
        return out

    @callback
    def _de_la_casa(self, uid: str) -> bool:
        house = _rt(self.hass).get("house")
        if house is not None and house.is_app_user(uid):
            return not self._invitado(uid)
        return any(p.attributes.get("user_id") == uid for p in self.hass.states.async_all("person"))

    @callback
    def lo_ve(self, a: dict[str, Any], uid: str) -> bool:
        yo = self.persona(uid)
        if yo & set(a.get("oculto") or []):
            return False
        return self._de_la_casa(uid) if a.get("para") is None else bool(yo & set(a["para"]))

    @callback
    def ve_fotos(self, uid: str) -> bool:
        """Los perfiles «Sin seguridad» y «Sólo luces y clima» no ven cámaras: tampoco las fotos."""
        rt = _rt(self.hass)
        house, ad = rt.get("house"), rt.get("app_devices")
        if house is None or not house.is_app_user(uid):
            return True
        if house.device_profile(uid) not in (None, "full"):
            return False
        from .app_devices import app_entries  # noqa: PLC0415

        return ad is None or all(ad.profile(e.data.get("device_id") or "")["profile"] == "full" for e in app_entries(self.hass) if e.data.get("user_id") == uid)

    @callback
    def listar(self, uid: str) -> list[dict[str, Any]]:
        fotos, yo = self.ve_fotos(uid), self.persona(uid)
        return [{"id": a["id"], "t": a["t"], "titulo": a["titulo"], "texto": a["texto"], "veces": a.get("veces", 1),
                 "nuevo": not (yo & set(a.get("visto") or [])), "foto": f"{URL}{a['id']}.jpg" if a.get("foto") and fotos else None}
                for a in self.items if self.lo_ve(a, uid)]

    def _usuarios(self, targets: list[str]) -> list[str]:
        por: dict[str, list[str]] = {}
        for e in self.hass.config_entries.async_entries("mobile_app"):
            if e.data.get("user_id"):
                por.setdefault(f"mobile_app_{slugify(e.data.get('device_name') or '')}", []).append(e.data["user_id"])
        return list(dict.fromkeys(u for t in targets for u in por.get(t, [])))

    # ------------------------------------------------------------ anotar
    @callback
    def anotar(self, titulo: str, texto: str, *, targets: list[str] | None, rule_id: str = "", camara: str | None = None,
               evento: str | None = None, repite: bool = False) -> dict[str, Any]:
        """Anota un aviso (y saca la foto si tiene cámara). `targets` None = para todos los de la casa."""
        now = time.time()
        para = None if targets is None else self._usuarios(targets)
        titulo, texto = " ".join(str(titulo or "Aviso").split())[:120], str(texto or "").strip()[:500]
        repite = repite and not (camara or evento)
        for a in self.items:
            if now - a["t"] > (JUNTAR_REPITE_S if repite else JUNTAR_S):
                break
            if (a["rule_id"], a["titulo"], a["texto"]) != (rule_id, titulo, texto):
                continue
            if not repite and now - a["t"] > JUNTAR_S:
                continue
            a["para"] = None if para is None or a.get("para") is None else list(dict.fromkeys([*a["para"], *para]))
            if now - a["t"] > JUNTAR_S:
                a.update(t=now, veces=a.get("veces", 1) + 1, visto=[], oculto=[])
                self.items = [a, *(x for x in self.items if x is not a)]
            self._cambio()
            return a
        a = {"id": uuid.uuid4().hex, "t": now, "titulo": titulo, "texto": texto, "rule_id": rule_id, "foto": False, "para": para, "visto": [], "oculto": []}
        self.items = [a, *self.items]
        if camara or evento:
            aid = a["id"]
            t = self.hass.async_create_task(self._foto(a, camara, evento))
            self.sacando[aid] = t
            t.add_done_callback(lambda _t: self.sacando.pop(aid, None))
        self.vencer()
        self._cambio()
        return a

    # ------------------------------------------------------------ foto
    async def _de_frigate(self, evento: str) -> bytes | None:
        """La foto del evento (la mejor, la del objeto): la da la integración de Frigate en este mismo HA."""
        if not EVENT_RE.match(evento):
            return None
        from homeassistant.helpers.aiohttp_client import async_get_clientsession  # noqa: PLC0415

        http = self.hass.http
        url = f"{'https' if getattr(http, 'ssl_certificate', None) else 'http'}://127.0.0.1:{http.server_port}/api/frigate/notifications/{evento}/snapshot.jpg"
        async with asyncio.timeout(4):
            async with async_get_clientsession(self.hass, verify_ssl=False).get(url) as r:
                return await r.read() if r.status == 200 and "image" in r.headers.get("Content-Type", "") else None

    async def _foto(self, a: dict[str, Any], camara: str | None, evento: str | None) -> None:
        data = None
        if evento and "frigate" in self.hass.config.components:
            try:
                data = await self._de_frigate(evento)
            except Exception:  # noqa: BLE001 - se saca de la cámara
                _LOGGER.debug("Aviso: no se pudo traer la foto de Frigate", exc_info=True)
        if not data and camara:
            try:
                from homeassistant.components.camera import async_get_image  # noqa: PLC0415

                data = (await async_get_image(self.hass, camara, timeout=FOTO_S)).content
            except Exception:  # noqa: BLE001 - sin foto, el aviso queda igual
                _LOGGER.debug("Aviso: la cámara %s no dio la foto", camara, exc_info=True)
        if not data:
            return

        def _write() -> bool:
            img = _achicar(data)
            if not img:
                return False
            os.makedirs(self.dir, exist_ok=True)
            with open(self.ruta(a["id"]), "wb") as f:
                f.write(img)
            return True

        ok = await self.hass.async_add_executor_job(_write)
        if ok and not any(x is a for x in self.items):  # lo borraron mientras tanto
            await self.hass.async_add_executor_job(os.remove, self.ruta(a["id"]))
        elif ok:
            a["foto"] = True
            self._cambio()

    # ------------------------------------------------------------ reglas armadas a mano o por Matte
    async def _servicio(self, call: ServiceCall) -> None:
        """Lo que antes era «notify.mobile_app_x» en una regla: se anota en la campanita y sale igual al celular."""
        d = call.data
        domain, _, svc = d["notify"].partition(".")
        if domain not in ("notify", "persistent_notification") or not svc:
            return
        foto, camara = d.get("foto") or "", None
        if foto.startswith("camera."):
            camara = foto if self.hass.states.get(foto) else None
        elif foto != "no":
            camara = camara_de(self.hass, d.get("sensor"))
        todos = domain == "persistent_notification"
        a = self.anotar(d.get("title") or d["rule"], d["message"], targets=None if todos else [svc], rule_id=d["rule_id"], camara=camara)
        body: dict[str, Any] = {"message": d["message"], **({"title": d["title"]} if d.get("title") else {})}
        if not todos:
            extra = dict(d.get("data") or {})
            self._en_la_notificacion(extra, svc, a, bool(camara))
            if extra:
                body["data"] = extra
        await self.hass.services.async_call(domain, svc, body, blocking=True, context=call.context)

    @callback
    def _en_la_notificacion(self, data: dict[str, Any], target: str, a: dict[str, Any], foto: bool) -> None:
        """La foto guardada (la baja el celular con su sesión) y, en la app MatterAI, tocar el aviso lo abre."""
        from .escenas.notify import app_targets  # noqa: PLC0415

        if foto and not data.get("image"):
            data["image"] = f"{URL}{a['id']}.jpg"
            data["attachment"] = {"url": data["image"], "content-type": "jpeg"}
        if target in app_targets(self.hass) and not data.get("clickAction") and not data.get("url"):
            data["clickAction"] = f"/avisos?id={a['id']}"

    # ------------------------------------------------------------ la persona
    @callback
    def vistos(self, uid: str) -> None:
        yo, n = self.persona(uid), 0
        for a in self.items:
            if not yo & set(a.get("visto") or []) and self.lo_ve(a, uid):
                a["visto"] = [*(a.get("visto") or []), uid]
                n += 1
        if n:
            self._cambio()

    @callback
    def borrar(self, uid: str, ids: list[str] | None) -> int:
        """Lo borra para esa persona (en todos sus equipos). Cuando no queda nadie que lo vea, se va con su foto."""
        yo = sorted(self.persona(uid))
        mios = [a for a in self.items if (ids is None or a["id"] in ids) and self.lo_ve(a, uid)]
        for a in mios:
            a["oculto"] = list(dict.fromkeys([*(a.get("oculto") or []), *yo]))
        house = _rt(self.hass).get("house")
        casa = {*(house.devices if house else ()), *(p.attributes.get("user_id") for p in self.hass.states.async_all("person"))} - {None}
        self._sacar([a for a in mios if not any(self.lo_ve(a, u) for u in (casa if a.get("para") is None else a["para"]))])
        if mios:
            self._cambio()
        return len(mios)

    @callback
    def olvidar(self, uid: str, nuevo: str | None = None) -> None:
        """Se desvinculó un equipo (o se volvió a vincular con otro usuario: sus avisos pasan al nuevo)."""
        fuera = []
        for a in self.items:
            for k in ("para", "visto", "oculto"):
                if uid in (a.get(k) or []):
                    a[k] = list(dict.fromkeys((nuevo if x == uid else x) for x in a[k] if x != uid or nuevo))
            if a.get("para") == []:
                fuera.append(a)
        self._sacar(fuera)
        self._cambio()


# ---------------------------------------------------------------- la foto
class AvisoFotoView(HomeAssistantView):
    url = URL + "{name}"
    name = f"api:{DOMAIN}:aviso"
    requires_auth = True  # con usuario o con link firmado (auth/sign_path)

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass

    async def get(self, request: web.Request, name: str) -> web.StreamResponse:
        m, av, user = NAME_RE.match(name), _rt(self.hass).get("avisos"), request["hass_user"]
        a = next((x for x in av.items if x["id"] == m.group(1)), None) if m and av else None
        if a is None or not av.lo_ve(a, user.id) or not av.ve_fotos(user.id):
            return web.Response(status=404)
        t = av.sacando.get(a["id"])
        if t is not None:  # recién salió el aviso: la foto está por llegar
            await asyncio.wait([t], timeout=FOTO_S + 2)
        path = av.ruta(a["id"])
        if not a.get("foto") or not await self.hass.async_add_executor_job(os.path.isfile, path):
            return web.Response(status=404)
        return web.FileResponse(path, headers={"Content-Type": "image/jpeg", "Cache-Control": "private, max-age=600", "X-Content-Type-Options": "nosniff"})


@callback
def async_register_view(hass: HomeAssistant) -> None:
    flag = f"{DOMAIN}_avisos_view"
    if not hass.data.get(flag):
        hass.http.register_view(AvisoFotoView(hass))
        hass.data[flag] = True


# ---------------------------------------------------------------- la app
@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/avisos/subscribe"})
@callback
def ws_avisos_subscribe(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Los avisos de esta persona, en vivo: {items}."""
    av = _rt(hass).get("avisos")
    if av is None:
        connection.send_error(msg["id"], "not_setup", "La integración MatterAI no está configurada")
        return

    @callback
    def _fwd() -> None:
        connection.send_message(websocket_api.event_message(msg["id"], {"items": av.listar(connection.user.id)}))

    connection.subscriptions[msg["id"]] = av.subscribe(_fwd)
    connection.send_result(msg["id"])
    _fwd()


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/avisos/vistos"})
@callback
def ws_avisos_vistos(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    av = _rt(hass).get("avisos")
    if av is not None:
        av.vistos(connection.user.id)
    connection.send_result(msg["id"], {"ok": av is not None})


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/avisos/borrar",
    vol.Required("ids"): vol.Any("todos", vol.All([vol.All(str, vol.Length(max=32))], vol.Length(min=1, max=MAX_AVISOS))),
})
@callback
def ws_avisos_borrar(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    av = _rt(hass).get("avisos")
    connection.send_result(msg["id"], {"borrados": av.borrar(connection.user.id, None if msg["ids"] == "todos" else msg["ids"]) if av else 0})


WS_COMMANDS = (ws_avisos_subscribe, ws_avisos_vistos, ws_avisos_borrar)
