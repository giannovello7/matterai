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
from homeassistant.helpers.storage import Store

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

STORAGE_KEY = f"{DOMAIN}.views"
KINDS = ("phone", "tablet")
MAX_VIEWS = 50
MAX_PINNED = 20

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
}, extra=vol.REMOVE_EXTRA)


def _rt(hass: HomeAssistant) -> dict[str, Any]:
    return hass.data.get(DOMAIN) or {}


class Views:
    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store: Store = Store(hass, 1, STORAGE_KEY)
        self.views: dict[str, dict[str, Any]] = {}
        self.assign: dict[str, str] = {}  # device_id de mobile_app → id del dashboard
        self.default: str | None = None

    async def async_load(self) -> None:
        data = await self._store.async_load() or {}
        self.views = data.get("views") or {}
        self.assign = data.get("assign") or {}
        self.default = data.get("default")

    def _save(self) -> None:
        self._store.async_delay_save(lambda: {"views": self.views, "assign": self.assign, "default": self.default}, 2)

    def put(self, view: dict[str, Any], by: str = "instalador") -> dict[str, Any]:
        vid = view.get("id") or uuid.uuid4().hex[:10]
        if vid not in self.views and len(self.views) >= MAX_VIEWS:
            raise ValueError(f"Máximo {MAX_VIEWS} dashboards por casa")
        old = self.views.get(vid, {})
        out = {**old, **view, "id": vid, "updated": time.time(), "by": by}
        out["pinned"] = list(dict.fromkeys(out.get("pinned") or []))  # sin repetidos, en orden
        self.views[vid] = out
        self._save()
        return out

    def delete(self, vid: str) -> bool:
        if vid not in self.views:
            return False
        self.views.pop(vid)
        self.assign = {d: v for d, v in self.assign.items() if v != vid}
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

    def for_device(self, device_id: str) -> dict[str, Any] | None:
        vid = self.assign.get(device_id) or self.default
        return self.views.get(vid) if vid else None

    def devices_of(self, vid: str) -> list[str]:
        return [d for d, v in self.assign.items() if v == vid]


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
    v = _rt(hass).get("views")
    ad = _rt(hass).get("app_devices")
    if v is None:
        connection.send_error(msg["id"], "not_setup", "La integración MatterAI no está configurada")
        return
    devices = [{"device_id": d["device_id"], "name": d["name"], "model": d.get("model", ""), "view": v.assign.get(d["device_id"])} for d in (ad.listing() if ad else [])]
    connection.send_result(msg["id"], {"views": list(v.views.values()), "default": v.default, "devices": devices})


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
    _notify(hass, v.devices_of(view["id"]) or (["all"] if v.default == view["id"] else []))
    connection.send_result(msg["id"], view)


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/views/delete", vol.Required("view_id"): str})
@websocket_api.require_admin
@callback
def ws_views_delete(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    v = _rt(hass).get("views")
    devs = v.devices_of(msg["view_id"])
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


# ---------------------------------------------------------------- la app
@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/app/view", vol.Required("device_id"): str})
@callback
def ws_app_view(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """El dashboard de este equipo (o el general de la casa, o ninguno: la app arma el suyo por defecto)."""
    v = _rt(hass).get("views")
    house = _rt(hass).get("house")
    if v is None or house is None or not (connection.user.is_admin or house.is_app_user(connection.user.id)):
        connection.send_error(msg["id"], "unauthorized", "Este usuario no es un equipo de la casa")
        return
    mine = v.assign.get(msg["device_id"]) if _owns_device(hass, connection.user.id, msg["device_id"]) else None
    view = v.views.get(mine) if mine else (v.views.get(v.default) if v.default else None)
    connection.send_result(msg["id"], {"view": view, "personal": bool(mine)})


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
    if vid and v.views.get(vid):
        base = v.views[vid]
    else:
        # sin dashboard propio: se arma uno personal partiendo del general (si hay)
        gen = v.views.get(v.default) if v.default else None
        name = msg["name"] or (house.devices.get(uid) or {}).get("name") or "Mi inicio"
        base = {"name": name[:40], "kind": (gen or {}).get("kind", "phone"), "featured": dict((gen or {}).get("featured") or {}), "scenes": (gen or {}).get("scenes")}
    who = (house.devices.get(uid) or {}).get("name") or "app"
    view = v.put({**base, "pinned": msg["pinned"]}, by=f"app · {who}")
    if not vid:
        v.set_assign(msg["device_id"], view["id"])
    others = [d for d in v.devices_of(view["id"]) if d != msg["device_id"]]
    _notify(hass, others)  # sus otros equipos (celular y tablet de la misma persona) se actualizan
    connection.send_result(msg["id"], view)


WS_COMMANDS = (ws_views_list, ws_views_save, ws_views_delete, ws_views_assign, ws_views_default, ws_app_view, ws_app_view_pin)
