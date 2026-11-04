"""Vinculación de los celulares: un acceso propio por equipo (ver house.py).

- POST /api/matterai/pair (sin usuario: lo protege el código de un solo uso) → el acceso del equipo.
- matterai/app/upgrade: un equipo con el acceso compartido de la versión anterior pasa al suyo, solo.
- matterai/app/invite: «Agregar otro celular» desde la app (un código nuevo para otro equipo).
- matterai/app/forget_me: el equipo se desvincula a sí mismo (Opciones → Desvincular).
- matterai/app/access · app/revoke · app/shared_off (instalador): ver, cortar uno, apagar el compartido.
"""

from __future__ import annotations

import json
import time
from typing import Any

from aiohttp import web
import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.components.http import HomeAssistantView
from homeassistant.core import HomeAssistant, callback

from .app_devices import app_entries
from .audit import log as audit_log
from .const import CONF_LOCAL_URL, CONF_NAME, CONF_SUPPORT, CONF_URL, CONF_WIFI, DOMAIN

PAIR_PATH = "/api/matterai/pair"
FAIL_MAX = 10
FAIL_WINDOW = 600.0


def _rt(hass: HomeAssistant) -> dict[str, Any] | None:
    rt = hass.data.get(DOMAIN) or {}
    return rt if rt.get("house") is not None and rt.get("entry") is not None else None


def _opt(entry, key: str, default: Any = "") -> Any:
    return entry.options.get(key, entry.data.get(key, default))


async def async_pairing_link(hass: HomeAssistant, by: str | None = None) -> dict[str, Any]:
    """Link y QR de vinculación (código de un solo uso) con los datos de la casa."""
    rt = _rt(hass)
    if rt is None:
        raise ValueError("La integración MatterAI no está configurada")
    entry = rt["entry"]
    url = _opt(entry, CONF_URL)
    if not url:
        raise ValueError("Falta la dirección remota de la casa (Configurar → Dirección)")
    return await rt["house"].async_pairing(url, _opt(entry, CONF_NAME), _opt(entry, CONF_SUPPORT, None),
                                           _opt(entry, CONF_LOCAL_URL), _opt(entry, CONF_WIFI), by=by)


async def async_forget(hass: HomeAssistant, user_id: str) -> bool:
    """Desvincula un equipo: su acceso, su registro de mobile_app (avisos, ubicación) y su perfil."""
    rt = _rt(hass)
    name = (rt["house"].devices.get(user_id) or {}).get("name", "") if rt else ""
    if rt is None or not await rt["house"].async_revoke(user_id):
        return False
    audit_log(hass, "access", "equipo desvinculado", name)
    ad = rt.get("app_devices")
    for e in app_entries(hass):
        if e.data.get("user_id") == user_id:
            if ad is not None:
                ad.devices.pop(e.data.get("device_id") or "", None)
            await hass.config_entries.async_remove(e.entry_id)
    if ad is not None:
        ad._save()  # noqa: SLF001
    return True


class PairView(HomeAssistantView):
    """La app canjea el código del QR / link por el acceso de ese equipo."""

    url = PAIR_PATH
    name = f"api:{DOMAIN}:pair"
    requires_auth = False
    cors_allowed = True

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._fails: dict[str, list[float]] = {}

    def _blocked(self, ip: str) -> bool:
        now = time.monotonic()
        hits = [t for t in self._fails.get(ip, []) if now - t < FAIL_WINDOW]
        self._fails[ip] = hits
        return len(hits) >= FAIL_MAX

    def _fail(self, ip: str) -> None:
        if len(self._fails) > 2000:
            self._fails.clear()
        self._fails.setdefault(ip, []).append(time.monotonic())

    async def post(self, request: web.Request) -> web.Response:
        ip = request.remote or "?"
        headers = {"Cache-Control": "no-store"}
        if self._blocked(ip):
            return self.json({"ok": False, "msg": "Demasiados intentos. Probá en unos minutos."}, status_code=429, headers=headers)
        try:
            body = await request.json()
        except (ValueError, json.JSONDecodeError):
            body = None
        if not isinstance(body, dict) or not isinstance(body.get("code"), str):
            return self.json({"ok": False, "msg": "Pedido inválido"}, status_code=400, headers=headers)
        rt = _rt(self.hass)
        got = await rt["house"].async_redeem(body["code"].strip(), body.get("name") or "") if rt else None
        if got is None:
            self._fail(ip)
            return self.json({"ok": False, "msg": "Este código ya se usó o venció. Pedí uno nuevo."}, status_code=403, headers=headers)
        user_id, token = got
        d = rt["house"].devices.get(user_id) or {}
        audit_log(self.hass, "access", "equipo vinculado", d.get("name", ""), "QR del instalador" if d.get("via") == "pair" else "agregado desde la app", f"desde {ip}")
        return self.json({"ok": True, "token": token, "user_id": user_id}, headers=headers)


@callback
def async_register_view(hass: HomeAssistant) -> None:
    flag = f"{DOMAIN}_pair_view"
    if not hass.data.get(flag):
        hass.http.register_view(PairView(hass))
        hass.data[flag] = True


# ---------------------------------------------------------------- comandos de la app
@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/app/upgrade",
    vol.Optional("name", default=""): str,
    vol.Optional("device_id", default=""): str,
})
@websocket_api.async_response
async def ws_app_upgrade(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Un equipo con el acceso compartido (versión anterior) recibe el suyo. No cambia nada para el cliente."""
    rt = _rt(hass)
    shared_id = connection.user.id
    got = await rt["house"].async_upgrade(shared_id, msg["name"]) if rt else None
    if got is None:
        connection.send_error(msg["id"], "not_shared", "Este equipo ya tiene su propio acceso")
        return
    audit_log(hass, "access", "equipo pasado a su propio acceso", msg["name"])
    # su registro de mobile_app (avisos, ubicación) pasa a su usuario: así se desvincula todo junto
    for e in app_entries(hass):
        if msg["device_id"] and e.data.get("device_id") == msg["device_id"] and e.data.get("user_id") == shared_id:
            hass.config_entries.async_update_entry(e, data={**e.data, "user_id": got[0]})
    connection.send_result(msg["id"], {"token": got[1], "user_id": got[0]})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/app/invite", vol.Optional("device_id", default=""): str})
@websocket_api.async_response
async def ws_app_invite(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """«Agregar otro celular»: sólo un equipo ya vinculado con perfil completo (o el instalador)."""
    rt = _rt(hass)
    user = connection.user
    if rt is None or not (user.is_admin or rt["house"].is_app_user(user.id)):
        connection.send_error(msg["id"], "unauthorized", "Este usuario no puede agregar equipos")
        return
    ad = rt.get("app_devices")
    if not user.is_admin and ad is not None and msg["device_id"] and ad.profile(msg["device_id"])["profile"] != "full":
        connection.send_error(msg["id"], "unauthorized", "Este equipo no puede agregar otros (pedíselo a quien administra la casa)")
        return
    try:
        link = await async_pairing_link(hass, by=user.id)
    except ValueError as err:
        connection.send_error(msg["id"], "not_ready", str(err))
        return
    connection.send_result(msg["id"], link)


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/app/forget_me"})
@websocket_api.async_response
async def ws_app_forget_me(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """El equipo se desvincula solo (Opciones de la app → Desvincular). El acceso compartido viejo no se borra así."""
    ok = await async_forget(hass, connection.user.id)
    connection.send_result(msg["id"], {"ok": ok})


# ---------------------------------------------------------------- instalador
@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/app/access"})
@websocket_api.require_admin
@callback
def ws_app_access(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    rt = _rt(hass)
    if rt is None:
        connection.send_error(msg["id"], "not_setup", "La integración MatterAI no está configurada")
        return
    house = rt["house"]
    entries = app_entries(hass)
    devices = []
    for d in house.listing():
        apps = [e.data.get("device_name") for e in entries if e.data.get("user_id") == d["user_id"]]
        devices.append({**d, "apps": [a for a in apps if a]})
    shared = house.shared_status()
    shared["devices"] = [e.data.get("device_name") for e in entries if house.is_shared_user(e.data.get("user_id"))]
    connection.send_result(msg["id"], {"devices": devices, "shared": shared})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/app/revoke", vol.Required("user_id"): str})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_app_revoke(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    if not await async_forget(hass, msg["user_id"]):
        connection.send_error(msg["id"], "not_found", "Ese equipo no está vinculado")
        return
    connection.send_result(msg["id"], {"ok": True})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/app/shared_off"})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_app_shared_off(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    rt = _rt(hass)
    if rt is None:
        connection.send_error(msg["id"], "not_setup", "La integración MatterAI no está configurada")
        return
    await rt["house"].async_shared_off()
    audit_log(hass, "access", "acceso compartido apagado", "", "instalador")
    connection.send_result(msg["id"], {"ok": True})


WS_COMMANDS = (ws_app_upgrade, ws_app_invite, ws_app_forget_me, ws_app_access, ws_app_revoke, ws_app_shared_off)
