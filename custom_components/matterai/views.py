"""Dashboards por persona (vistas): qué ve primero cada uno en la app.

- El instalador crea dashboards en el panel MatterAI («Gianfranco», «Flavio», «Tablet living»…) y elige:
  tipo (celular o tablet de pared), ambientes fijados y su orden, lo destacado (cámara + portón) y las escenas.
- Cada dashboard se asigna a uno o más equipos (los de esa persona). Un equipo sin dashboard ve el general.
- Desde la app, cada uno fija, saca u ordena ambientes: se guarda en SU dashboard (si no tenía, se le crea uno
  personal). Un equipo sólo puede cambiar el dashboard que tiene asignado.
- Esto decide qué se ve primero, no qué se puede tocar: los permisos siguen siendo el perfil del equipo.
"""

from __future__ import annotations

import logging
import time
import uuid
from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.event import async_call_later
from homeassistant.helpers.storage import Store

from .const import DOMAIN
from .view_schema import BLOCK, PLAN, ROOM_PAGES, check_size, layout_schema

_LOGGER = logging.getLogger(__name__)

STORAGE_KEY = f"{DOMAIN}.views"
KINDS = ("phone", "tablet")
MAX_VIEWS = 50
MAX_PINNED = 20
MAX_BLOCKS = 30
MAX_HISTORY = 12      # versiones anteriores que se guardan de cada dashboard
PREVIEW_MIN = 15      # «Probar en el equipo»: cuánto dura el diseño sin guardar en los equipos
DESIGN_KEYS = ("name", "kind", "layouts", "blocks", "orientation", "plan", "pinned", "featured", "scenes")

VIEW_SCHEMA = vol.Schema({
    vol.Optional("id"): vol.All(str, vol.Length(max=32)),
    vol.Required("name"): vol.All(str, vol.Strip, vol.Length(min=1, max=40)),
    vol.Optional("kind", default="phone"): vol.In(KINDS),
    vol.Optional("pinned", default=list): vol.All([vol.All(str, vol.Length(max=60))], vol.Length(max=MAX_PINNED)),
    vol.Optional("featured", default=dict): vol.Schema({
        vol.Optional("title"): vol.Any(None, vol.All(str, vol.Length(max=40))),
        vol.Optional("camera"): vol.Any(None, cv.entity_id),
        vol.Optional("gate"): vol.Any(None, cv.entity_id),
    }),
    vol.Optional("scenes"): vol.Any(None, vol.All([cv.entity_id], vol.Length(max=12))),
    # editor de tarjetas (desde la 2.13): si hay «blocks», la app dibuja eso; si no, el prearmado
    vol.Optional("orientation"): vol.Any(None, vol.In(["landscape", "portrait", "auto"])),
    vol.Optional("blocks"): vol.Any(None, vol.All([BLOCK], vol.Length(max=MAX_BLOCKS))),
    vol.Optional("plan"): vol.Any(None, PLAN),
    # desde la 2.14: un mismo dashboard (el de una persona) tiene su diseño de celular y el de tablet
    vol.Optional("layouts"): vol.Any(None, vol.Schema({
        vol.Optional("phone"): vol.Any(None, layout_schema(MAX_BLOCKS)),
        vol.Optional("tablet"): vol.Any(None, layout_schema(MAX_BLOCKS)),
    }, extra=vol.REMOVE_EXTRA)),
    # desde la 2.25: versión propia de un ambiente en este dashboard (si no, la de la casa)
    vol.Optional("room_pages"): vol.Any(None, ROOM_PAGES),
}, extra=vol.REMOVE_EXTRA)
VIEW_SCHEMA = vol.All(VIEW_SCHEMA, check_size)


def _rt(hass: HomeAssistant) -> dict[str, Any]:
    return hass.data.get(DOMAIN) or {}


class Views:
    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store: Store = Store(hass, 1, STORAGE_KEY)
        self.views: dict[str, dict[str, Any]] = {}
        self.assign: dict[str, str] = {}  # device_id de mobile_app → id del dashboard
        self.users: dict[str, str] = {}   # usuario de un equipo vinculado → id del dashboard (anda aunque no haya mobile_app)
        self.default: str | None = None
        self.history: dict[str, list[dict[str, Any]]] = {}  # versiones anteriores de cada dashboard (la más nueva primero)
        self.previews: dict[str, dict[str, Any]] = {}       # «Probar en el equipo»: diseño sin guardar (sólo en memoria)
        self.preview_timers: dict[str, Any] = {}
        self.seen: dict[str, str] = {}  # usuario de un equipo → «phone» o «tablet» (lo que pidió la última vez)

    async def async_load(self) -> None:
        data = await self._store.async_load() or {}
        self.views = data.get("views") or {}
        self.assign = data.get("assign") or {}
        self.users = data.get("users") or {}
        self.default = data.get("default")
        self.history = data.get("history") or {}
        self.seen = data.get("seen") or {}

    def _save(self) -> None:
        self._store.async_delay_save(lambda: {"views": self.views, "assign": self.assign, "users": self.users, "default": self.default, "history": self.history,
                                              "seen": self.seen}, 2)

    def put(self, view: dict[str, Any], by: str = "instalador") -> dict[str, Any]:
        vid = view.get("id") or uuid.uuid4().hex[:10]
        if vid not in self.views and len(self.views) >= MAX_VIEWS:
            raise ValueError(f"Máximo {MAX_VIEWS} dashboards por casa")
        old = self.views.get(vid, {})
        out = {**old, **view, "id": vid, "updated": time.time(), "by": by}
        out["pinned"] = list(dict.fromkeys(out.get("pinned") or []))  # sin repetidos, en orden
        if old and any(old.get(k) != out.get(k) for k in DESIGN_KEYS):
            # la versión anterior queda en el historial (se puede volver a ella desde el editor)
            snap = {k: old.get(k) for k in DESIGN_KEYS if old.get(k) is not None}
            snap.update(t=old.get("updated") or time.time(), by=old.get("by") or "")
            self.history[vid] = ([snap] + self.history.get(vid, []))[:MAX_HISTORY]
        self.views[vid] = out
        self._save()
        return out

    def preview(self, vid: str) -> dict[str, Any] | None:
        p = self.previews.get(vid)
        if p and p["until"] < time.time():
            self.previews.pop(vid, None)
            return None
        return p["view"] if p else None

    def delete(self, vid: str) -> bool:
        if vid not in self.views:
            return False
        self.views.pop(vid)
        self.history.pop(vid, None)
        self.previews.pop(vid, None)
        self.assign = {d: v for d, v in self.assign.items() if v != vid}
        self.users = {u: v for u, v in self.users.items() if v != vid}
        if self.default == vid:
            self.default = None
        self._save()
        return True

    def set_assign(self, device_id: str, vid: str | None) -> None:
        if vid:
            if vid not in self.views:
                raise ValueError("Ese dashboard no existe")
            self.assign[device_id] = vid
        else:
            self.assign.pop(device_id, None)
        self._save()

    def set_user(self, user_id: str, vid: str | None) -> None:
        if vid:
            if vid not in self.views:
                raise ValueError("Ese dashboard no existe")
            self.users[user_id] = vid
        else:
            self.users.pop(user_id, None)
        self._save()

    def for_device(self, device_id: str) -> dict[str, Any] | None:
        vid = self.assign.get(device_id) or self.default
        return self.views.get(vid) if vid else None

    def devices_of(self, vid: str) -> list[str]:
        return [d for d, v in self.assign.items() if v == vid]


def resolve(view: dict[str, Any] | None, kind: str | None) -> dict[str, Any] | None:
    """El dashboard listo para un equipo: con las tarjetas del diseño de su tipo (celular o tablet).

    Sin diseño para ese tipo, va sin tarjetas y la app arma el prearmado. Los dashboards viejos
    (una sola lista de tarjetas) valen para el tipo con el que se crearon."""
    if not view:
        return view
    kind = kind if kind in KINDS else view.get("kind", "phone")
    lay = (view.get("layouts") or {}).get(kind)
    if lay is None and view.get("blocks") and view.get("kind", "phone") == kind:
        lay = {"blocks": view.get("blocks"), "orientation": view.get("orientation")}
    out = {k: val for k, val in view.items() if k != "layouts"}
    out["kind"] = kind
    out["blocks"] = (lay or {}).get("blocks") or None
    out["orientation"] = (lay or {}).get("orientation") or view.get("orientation")
    out["header"] = (lay or {}).get("header") or None  # qué se ve arriba (hora, clima, avisos, menú)
    out["dock"] = (lay or {}).get("dock") or None      # botones de la barra de abajo, en orden
    out["theme"] = (lay or {}).get("theme") or None    # oscuro, claro o automático (según el equipo)
    out["style"] = (lay or {}).get("style") or None    # estilo prearmado (MatterAI, tipo Apple, cristal)
    out["bg"] = (lay or {}).get("bg") or None          # fondo propio (color, degradé o imagen de la casa)
    for k in ("v", "cols", "side"):                    # diseño v2: columnas de la tablet con su ancho
        if (lay or {}).get(k) is not None:
            out[k] = lay[k]
    return out


def _user_devices(hass: HomeAssistant, user_ids: set[str]) -> list[str]:
    from .app_devices import app_entries  # noqa: PLC0415

    return [e.data.get("device_id") for e in app_entries(hass) if e.data.get("user_id") in user_ids and e.data.get("device_id")]


def _targets(hass: HomeAssistant, v: Views, vid: str) -> list[str]:
    """Los equipos que muestran ese dashboard (por equipo o por su usuario)."""
    if v.default == vid:
        return ["all"]
    users = {u for u, x in v.users.items() if x == vid}
    # por el usuario también: la app web no tiene registro de mobile_app (no tiene device_id)
    out = set(v.devices_of(vid)) | set(_user_devices(hass, users)) | users
    return sorted(out)


def _notify(hass: HomeAssistant, device_ids: list[str]) -> None:
    """Los equipos con ese dashboard lo vuelven a pedir al instante."""
    from .app_devices import fire_command  # noqa: PLC0415

    if device_ids:
        fire_command(hass, "view", device_ids)


def _owns_device(hass: HomeAssistant, user_id: str, device_id: str) -> bool:
    """¿Ese device_id (registro de mobile_app) es de este usuario? Con el acceso compartido viejo no hay cómo saberlo."""
    from .app_devices import app_entries  # noqa: PLC0415

    house = _rt(hass).get("house")
    for e in app_entries(hass):
        if e.data.get("device_id") == device_id:
            if e.data.get("user_id") == user_id:
                return True
            return bool(house and house.is_shared_user(user_id) and house.is_shared_user(e.data.get("user_id")))
    return False


# ---------------------------------------------------------------- instalador
@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/views/list"})
@websocket_api.require_admin
@callback
def ws_views_list(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    from .app_devices import app_entries  # noqa: PLC0415

    v = _rt(hass).get("views")
    ad = _rt(hass).get("app_devices")
    house = _rt(hass).get("house")
    if v is None:
        connection.send_error(msg["id"], "not_setup", "La integración MatterAI no está configurada")
        return
    devices = [{"device_id": d["device_id"], "name": d["name"], "model": d.get("model", ""), "view": v.assign.get(d["device_id"])} for d in (ad.listing() if ad else [])]
    # cada equipo vinculado (celular o tablet) con su acceso propio: aparece aunque no se haya registrado en mobile_app
    entries = app_entries(hass)
    people = []
    for d in (house.listing() if house else []):
        mine = [e for e in entries if e.data.get("user_id") == d["user_id"]]
        people.append({
            "user_id": d["user_id"], "name": d.get("name") or "Equipo", "last_used": d.get("last_used"), "created": d.get("created"),
            "model": " ".join(x for x in (mine[0].data.get("manufacturer"), mine[0].data.get("model")) if x) if mine else "",
            "devices": [e.data.get("device_id") for e in mine if e.data.get("device_id")],
            "view": v.users.get(d["user_id"]) or next((v.assign[e.data["device_id"]] for e in mine if v.assign.get(e.data.get("device_id"))), None),
            "kind": v.seen.get(d["user_id"]),  # «phone» / «tablet»: el diseño que usa (None: todavía no abrió la app)
        })
    connection.send_result(msg["id"], {"views": list(v.views.values()), "default": v.default, "devices": devices, "people": people})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/views/save", vol.Required("view"): dict})
@websocket_api.require_admin
@callback
def ws_views_save(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    v = _rt(hass).get("views")
    try:
        view = v.put(VIEW_SCHEMA(msg["view"]))
    except (vol.Invalid, ValueError) as err:
        connection.send_error(msg["id"], "invalid", str(err))
        return
    _notify(hass, _targets(hass, v, view["id"]))
    connection.send_result(msg["id"], view)


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/views/delete", vol.Required("view_id"): str})
@websocket_api.require_admin
@callback
def ws_views_delete(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    v = _rt(hass).get("views")
    devs = _targets(hass, v, msg["view_id"])
    if not v.delete(msg["view_id"]):
        connection.send_error(msg["id"], "not_found", "Ese dashboard no existe")
        return
    _notify(hass, devs)
    connection.send_result(msg["id"], {"ok": True})


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/views/assign",
    vol.Required("device_id"): str,
    vol.Optional("view_id"): vol.Any(str, None),
})
@websocket_api.require_admin
@callback
def ws_views_assign(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    v = _rt(hass).get("views")
    try:
        v.set_assign(msg["device_id"], msg.get("view_id"))
    except ValueError as err:
        connection.send_error(msg["id"], "invalid", str(err))
        return
    _notify(hass, [msg["device_id"]])
    connection.send_result(msg["id"], {"ok": True})


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/views/assign_user",
    vol.Required("user_id"): vol.All(str, vol.Length(max=64)),
    vol.Optional("view_id"): vol.Any(str, None),
})
@websocket_api.require_admin
@callback
def ws_views_assign_user(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Asignar un dashboard a un equipo vinculado (su usuario), aunque no esté registrado en mobile_app."""
    v = _rt(hass).get("views")
    house = _rt(hass).get("house")
    uid = msg["user_id"]
    if v is None or house is None or not house.is_device_user(uid):
        connection.send_error(msg["id"], "not_found", "Ese equipo no está vinculado")
        return
    try:
        v.set_user(uid, msg.get("view_id"))
    except ValueError as err:
        connection.send_error(msg["id"], "invalid", str(err))
        return
    devs = _user_devices(hass, {uid})
    for d in devs:  # lo elegido para el equipo manda sobre una asignación vieja por mobile_app
        v.assign.pop(d, None)
    v._save()  # noqa: SLF001
    _notify(hass, devs)
    connection.send_result(msg["id"], {"ok": True})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/views/default", vol.Optional("view_id"): vol.Any(str, None)})
@websocket_api.require_admin
@callback
def ws_views_default(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    v = _rt(hass).get("views")
    vid = msg.get("view_id")
    if vid and vid not in v.views:
        connection.send_error(msg["id"], "invalid", "Ese dashboard no existe")
        return
    v.default = vid or None
    v._save()  # noqa: SLF001
    _notify(hass, ["all"])
    connection.send_result(msg["id"], {"ok": True})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/views/preview", vol.Required("view"): dict})
@websocket_api.require_admin
@callback
def ws_views_preview(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """«Probar en el equipo»: los equipos con ese dashboard muestran el diseño sin guardar por unos minutos."""
    v = _rt(hass).get("views")
    try:
        view = VIEW_SCHEMA(msg["view"])
    except vol.Invalid as err:
        connection.send_error(msg["id"], "invalid", str(err))
        return
    vid = view.get("id")
    if not vid or vid not in v.views:
        connection.send_error(msg["id"], "not_found", "Guardá el dashboard una vez antes de probarlo")
        return
    until = time.time() + PREVIEW_MIN * 60
    v.previews[vid] = {"view": {**v.views[vid], **view, "id": vid}, "until": until}
    targets = _targets(hass, v, vid)
    _notify(hass, targets)

    @callback
    def _expired(_now: Any) -> None:  # al vencer, los equipos vuelven solos al diseño guardado
        v.preview_timers.pop(vid, None)
        p = v.previews.get(vid)
        if p and p["until"] <= time.time() + 1:
            v.previews.pop(vid, None)
            _notify(hass, _targets(hass, v, vid))

    old = v.preview_timers.pop(vid, None)
    if old:
        old()
    v.preview_timers[vid] = async_call_later(hass, PREVIEW_MIN * 60 + 1, _expired)
    connection.send_result(msg["id"], {"until": until, "minutes": PREVIEW_MIN, "devices": len(targets) if targets != ["all"] else -1})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/views/preview_end", vol.Required("view_id"): str})
@websocket_api.require_admin
@callback
def ws_views_preview_end(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    v = _rt(hass).get("views")
    unsub = v.preview_timers.pop(msg["view_id"], None)
    if unsub:
        unsub()
    if v.previews.pop(msg["view_id"], None) is not None:
        _notify(hass, _targets(hass, v, msg["view_id"]))
    connection.send_result(msg["id"], {"ok": True})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/views/history", vol.Required("view_id"): str})
@websocket_api.require_admin
@callback
def ws_views_history(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Las versiones anteriores de un dashboard (resumen: cuándo, quién y cuántas tarjetas)."""
    v = _rt(hass).get("views")

    def count(s: dict, k: str) -> int:
        lay = (s.get("layouts") or {}).get(k) or {}
        return len(lay.get("blocks") or (s.get("blocks") if s.get("kind", "phone") == k else None) or [])

    out = [{"index": i, "t": s.get("t"), "by": s.get("by"), "name": s.get("name"), "phone": count(s, "phone"), "tablet": count(s, "tablet")}
           for i, s in enumerate(v.history.get(msg["view_id"], []))]
    connection.send_result(msg["id"], {"versions": out})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/views/history_get", vol.Required("view_id"): str, vol.Required("index"): vol.All(int, vol.Range(min=0, max=MAX_HISTORY))})
@websocket_api.require_admin
@callback
def ws_views_history_get(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    v = _rt(hass).get("views")
    hist = v.history.get(msg["view_id"], [])
    if msg["index"] >= len(hist):
        connection.send_error(msg["id"], "not_found", "Esa versión ya no está")
        return
    connection.send_result(msg["id"], {**hist[msg["index"]], "id": msg["view_id"]})


# ---------------------------------------------------------------- la app
@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/app/view", vol.Required("device_id"): str, vol.Optional("kind"): vol.In(KINDS)})
@callback
def ws_app_view(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """El dashboard de este equipo (o el general de la casa, o ninguno: la app arma el suyo por defecto)."""
    v = _rt(hass).get("views")
    house = _rt(hass).get("house")
    if v is None or house is None or not (connection.user.is_admin or house.is_app_user(connection.user.id)):
        connection.send_error(msg["id"], "unauthorized", "Este usuario no es un equipo de la casa")
        return
    mine = v.assign.get(msg["device_id"]) if _owns_device(hass, connection.user.id, msg["device_id"]) else None
    mine = (mine if mine in v.views else None) or (v.users.get(connection.user.id) if house.is_device_user(connection.user.id) else None)
    view = v.views.get(mine) if mine else (v.views.get(v.default) if v.default else None)
    if msg.get("kind") in KINDS and v.seen.get(connection.user.id) != msg["kind"]:
        v.seen[connection.user.id] = msg["kind"]  # así el panel sabe si ese equipo es celular o tablet
        v._save()  # noqa: SLF001
    trial = v.preview(view["id"]) if view else None  # el instalador está probando un diseño sin guardar
    connection.send_result(msg["id"], {"view": resolve(trial or view, msg.get("kind")), "personal": bool(mine), "preview": bool(trial)})


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/app/view_pin",
    vol.Required("device_id"): str,
    vol.Required("pinned"): vol.All([vol.All(str, vol.Length(max=60))], vol.Length(max=MAX_PINNED)),
    vol.Optional("name", default=""): vol.All(str, vol.Length(max=40)),
})
@callback
def ws_app_view_pin(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Fijar / sacar / ordenar desde la app: cambia sólo el dashboard de ESTE equipo (si no tiene, se le crea uno)."""
    v = _rt(hass).get("views")
    house = _rt(hass).get("house")
    uid = connection.user.id
    if v is None or house is None or not house.is_app_user(uid) or not _owns_device(hass, uid, msg["device_id"]):
        connection.send_error(msg["id"], "unauthorized", "Este equipo no puede cambiar ese dashboard")
        return
    vid = v.assign.get(msg["device_id"])
    if not (vid and v.views.get(vid)) and house.is_device_user(uid):
        vid = v.users.get(uid)
    if vid and v.views.get(vid):
        base = v.views[vid]
    else:
        # sin dashboard propio: se arma uno personal partiendo del general (si hay)
        gen = v.views.get(v.default) if v.default else None
        name = msg["name"] or (house.devices.get(uid) or {}).get("name") or "Mi inicio"
        base = {"name": name[:40], "kind": (gen or {}).get("kind", "phone"), "featured": dict((gen or {}).get("featured") or {}), "scenes": (gen or {}).get("scenes")}
    who = (house.devices.get(uid) or {}).get("name") or "app"
    new = {**base, "pinned": msg["pinned"]}
    def pin_rooms(blocks: list | None) -> list | None:
        """Con el editor de tarjetas: lo fijado es la tarjeta de ambientes."""
        if not blocks:
            return blocks
        out = [dict(b) for b in blocks]
        rb = next((b for b in out if b.get("type") == "rooms"), None)
        if rb is not None:
            rb["cfg"] = {**(rb.get("cfg") or {}), "rooms": msg["pinned"], "auto": False}
        return out

    if base.get("blocks"):
        new["blocks"] = pin_rooms(base["blocks"])
    if base.get("layouts"):
        new["layouts"] = {k: ({**lay, "blocks": pin_rooms(lay.get("blocks"))} if lay else lay) for k, lay in base["layouts"].items()}
    try:
        clean = VIEW_SCHEMA({k: val for k, val in new.items() if k not in ("updated", "by")})
    except vol.Invalid as err:
        connection.send_error(msg["id"], "invalid", str(err))
        return
    view = v.put(clean, by=f"app · {who}")
    if not vid:
        if house.is_device_user(uid):
            v.set_user(uid, view["id"])
        else:
            v.set_assign(msg["device_id"], view["id"])
    others = [d for d in _targets(hass, v, view["id"]) if d != msg["device_id"]]
    _notify(hass, others)  # sus otros equipos (celular y tablet de la misma persona) se actualizan
    connection.send_result(msg["id"], view)


WS_COMMANDS = (ws_views_list, ws_views_save, ws_views_delete, ws_views_assign, ws_views_assign_user, ws_views_default, ws_views_preview,
               ws_views_preview_end, ws_views_history, ws_views_history_get, ws_app_view, ws_app_view_pin)
