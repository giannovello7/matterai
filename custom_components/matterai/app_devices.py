"""Los celulares y tablets con la app MatterAI de esta casa.

- Perfil de cada equipo (lo elige el instalador desde el panel): completo, sin seguridad (para chicos)
  o sólo luces y clima. La app esconde lo que el perfil no muestra.
- «Pedir huella»: alarma, cerraduras y portón piden la huella (o el PIN del celular) en ese equipo.
- Qué equipo hizo qué: la app avisa cada orden (evento matterai_app_action por el webhook de mobile_app)
  y la pantalla Actividad muestra «Desde la app · Celular de Juan» en lugar de sólo «Desde la app».
- Órdenes para las tablets (servicio matterai.app_command): prender la pantalla, mostrar una cámara,
  abrir una pantalla, decir un mensaje… Las tablets de pared tienen la app siempre abierta y escuchan
  el evento matterai_app_command.
"""

from __future__ import annotations

import hashlib
import time
import uuid
from collections import deque
from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import Event, HomeAssistant, ServiceCall, callback
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.storage import Store
from homeassistant.util import slugify

from .const import DOMAIN

APP_ID = "ar.com.matterai.app"
EVENT_ACTION = f"{DOMAIN}_app_action"
EVENT_COMMAND = f"{DOMAIN}_app_command"
STORAGE_KEY = f"{DOMAIN}.app_devices"
MAX_ACTIONS = 400

PROFILES = {
    "full": "Completo",
    "kids": "Sin seguridad",
    "basic": "Sólo luces y clima",
}
COMMANDS = ["screen_on", "screen_off", "brightness", "open", "camera", "tts", "reload", "saver", "doorbell", "doorbell_end"]
# pruebas a distancia desde el panel (Equipos): un aviso en pantalla, recargar la app o prender la pantalla
TESTS = ["hello", "reload", "screen_on"]


def app_entries(hass: HomeAssistant) -> list:
    return [e for e in hass.config_entries.async_entries("mobile_app") if e.data.get("app_id") == APP_ID]


def push_hashes(hass: HomeAssistant) -> list[str]:
    """Para el panel central: sha256 de «push_token|webhook_id» de cada equipo con la app.

    El panel sólo reenvía notificaciones a estos equipos (y nunca ve el token ni el webhook)."""
    out = []
    for e in app_entries(hass):
        token = ((e.data.get("app_data") or {}).get("push_token") or "").strip()
        webhook = e.data.get("webhook_id") or ""
        if token and webhook:
            out.append(hashlib.sha256(f"{token}|{webhook}".encode()).hexdigest())
    return sorted(set(out))


class AppDevices:
    """Perfiles guardados + registro en memoria de las órdenes de cada equipo."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store: Store = Store(hass, 1, STORAGE_KEY)
        self.devices: dict[str, dict[str, Any]] = {}
        self.actions: deque[dict[str, Any]] = deque(maxlen=MAX_ACTIONS)
        # equipos con la app abierta ahora (escuchando órdenes): device_id -> conexiones
        self.online: dict[str, int] = {}
        self.last_seen: dict[str, float] = {}
        self._unsub = None

    async def async_load(self) -> None:
        data = await self._store.async_load() or {}
        self.devices = data.get("devices") or {}
        self.actions.extend(data.get("actions") or [])
        self._unsub = self.hass.bus.async_listen(EVENT_ACTION, self._on_action)

    def stop(self) -> None:
        if self._unsub:
            self._unsub()
            self._unsub = None

    def _save(self) -> None:
        self._store.async_delay_save(lambda: {"devices": self.devices, "actions": list(self.actions)}, 30)

    @callback
    def _on_action(self, event: Event) -> None:
        d = event.data or {}
        eid = d.get("entity_id")
        if not eid:
            return
        ids = eid if isinstance(eid, list) else [eid]
        self.actions.append({
            "t": time.time(),
            "entity_ids": [str(x) for x in ids][:20],
            "service": str(d.get("service") or "")[:60],
            "device": str(d.get("device") or "")[:60],
            "device_id": str(d.get("device_id") or "")[:64],
        })
        self._save()

    def profile(self, device_id: str) -> dict[str, Any]:
        p = self.devices.get(device_id) or {}
        return {"profile": p.get("profile") if p.get("profile") in PROFILES else "full", "secure": bool(p.get("secure"))}

    def set(self, device_id: str, profile: str | None, secure: bool | None) -> None:
        p = self.devices.setdefault(device_id, {})
        if profile is not None:
            p["profile"] = profile
        if secure is not None:
            p["secure"] = secure
        self._save()

    def listing(self) -> list[dict[str, Any]]:
        out = []
        for e in app_entries(self.hass):
            dev_id = e.data.get("device_id") or ""
            name = e.data.get("device_name") or "Equipo"
            notify = f"mobile_app_{slugify(name)}"
            out.append({
                "device_id": dev_id,
                "name": name,
                "model": " ".join(x for x in (e.data.get("manufacturer"), e.data.get("model")) if x),
                "app_version": e.data.get("app_version") or "",
                "push": bool((e.data.get("app_data") or {}).get("push_token")),
                "notify": f"notify.{notify}" if self.hass.services.has_service("notify", notify) else None,
                "online": self.online.get(dev_id, 0) > 0,
                "seen": self.last_seen.get(dev_id),
                **self.profile(dev_id),
            })
        return out


def _rt_devices(hass: HomeAssistant) -> AppDevices | None:
    rt = hass.data.get(DOMAIN) or {}
    return rt.get("app_devices")


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/app/me", vol.Required("device_id"): str})
@callback
def ws_app_me(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Lo pide la app al conectarse: el perfil que le puso el instalador a este equipo."""
    ad = _rt_devices(hass)
    out = ad.profile(msg["device_id"]) if ad else {"profile": "full", "secure": False}
    house = (hass.data.get(DOMAIN) or {}).get("house")
    # un invitado entra con el perfil de su link mientras el instalador no le elija otro
    if house is not None and ad is not None and not (ad.devices.get(msg["device_id"]) or {}).get("profile"):
        gp = house.device_profile(connection.user.id)
        if gp in PROFILES:
            out["profile"] = gp
    if house is not None and (connection.user.is_admin or house.is_app_user(connection.user.id)):
        # firma de los accesos rápidos / stickers NFC de esta casa, y si todavía usa el acceso compartido viejo
        out["run_key"] = house.run_key
        out["shared"] = house.is_shared_user(connection.user.id)
    connection.send_result(msg["id"], out)


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/app/actions", vol.Optional("since", default=0): vol.Coerce(float)})
@callback
def ws_app_actions(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Qué equipo dio cada orden (para la pantalla Actividad)."""
    ad = _rt_devices(hass)
    since = msg["since"]
    connection.send_result(msg["id"], [a for a in (ad.actions if ad else []) if a["t"] >= since])


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/app/devices"})
@websocket_api.require_admin
@callback
def ws_app_devices(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    ad = _rt_devices(hass)
    connection.send_result(msg["id"], {"devices": ad.listing() if ad else [], "profiles": PROFILES})


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/app/device_set",
    vol.Required("device_id"): str,
    vol.Optional("profile"): vol.In(list(PROFILES)),
    vol.Optional("secure"): bool,
})
@websocket_api.require_admin
@callback
def ws_app_device_set(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    ad = _rt_devices(hass)
    if ad is None:
        connection.send_error(msg["id"], "not_setup", "La integración MatterAI no está configurada")
        return
    ad.set(msg["device_id"], msg.get("profile"), msg.get("secure"))
    from .audit import log as audit_log  # noqa: PLC0415

    audit_log(hass, "access", "perfil del equipo", msg["device_id"], "instalador", f"perfil {msg.get('profile') or '='}{' · pedir huella' if msg.get('secure') else ''}")
    # la app de ese equipo lo toma al momento
    hass.bus.async_fire(EVENT_COMMAND, {"id": uuid.uuid4().hex, "command": "profile", "target": [msg["device_id"]]})
    connection.send_result(msg["id"], {"ok": True})


def _targets_me(target: Any, device_id: str, name: str, user_id: str = "") -> bool:
    if target in (None, "", "all"):
        return True
    names = {str(t).strip().lower() for t in (target if isinstance(target, list) else [target])}
    return ("all" in names or (bool(device_id) and device_id.lower() in names) or (bool(user_id) and user_id.lower() in names)
            or (bool(name) and (name.strip().lower() in names or slugify(name) in names)))


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/app/subscribe",
    vol.Optional("device_id", default=""): str,
    vol.Optional("name", default=""): str,
})
@callback
def ws_app_subscribe(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """La app escucha las órdenes para este equipo (la app no es administradora: no puede escuchar eventos propios)."""

    @callback
    def _fwd(event: Event) -> None:
        d = event.data or {}
        if _targets_me(d.get("target"), msg["device_id"], msg["name"], connection.user.id if connection.user else ""):
            connection.send_message(websocket_api.event_message(msg["id"], dict(d)))

    unsub = hass.bus.async_listen(EVENT_COMMAND, _fwd)
    ad, dev = _rt_devices(hass), msg["device_id"][:64]
    if ad is None or not dev:
        connection.subscriptions[msg["id"]] = unsub
        connection.send_result(msg["id"])
        return
    # mientras la app escucha, el panel la muestra «conectada ahora»
    ad.online[dev] = ad.online.get(dev, 0) + 1
    ad.last_seen[dev] = time.time()

    @callback
    def _bye() -> None:
        unsub()
        ad.last_seen[dev] = time.time()
        n = ad.online.get(dev, 0) - 1
        if n > 0:
            ad.online[dev] = n
        else:
            ad.online.pop(dev, None)

    connection.subscriptions[msg["id"]] = _bye
    connection.send_result(msg["id"])


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/app/notify_action", vol.Required("action"): vol.Match(r"^MAE\|[^|]+\|[^|]+$")})
@callback
def ws_app_notify_action(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Botón del portero en la pantalla de la app (tablet de pared): igual que tocarlo en la notificación.
    Sólo los equipos vinculados a la casa (o el instalador)."""
    house = (hass.data.get(DOMAIN) or {}).get("house")
    if not connection.user.is_admin and (house is None or not house.is_app_user(connection.user.id)):
        connection.send_error(msg["id"], "unauthorized", "Este usuario no es un equipo de la casa")
        return
    hass.bus.async_fire("mobile_app_notification_action", {"action": msg["action"]}, context=connection.context(msg))
    connection.send_result(msg["id"], {"ok": True})


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/app/test",
    vol.Required("device_id"): str,
    vol.Required("command"): vol.In(TESTS),
})
@websocket_api.require_admin
@callback
def ws_app_test(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Prueba a distancia desde el panel: le llega sólo a ese equipo (si tiene la app abierta)."""
    ad = _rt_devices(hass)
    online = bool(ad and ad.online.get(msg["device_id"], 0) > 0)
    fire_command(hass, msg["command"], [msg["device_id"]], message="Prueba desde el panel MatterAI: este equipo recibe las órdenes de la casa.")
    connection.send_result(msg["id"], {"ok": True, "online": online})


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/app/message",
    vol.Required("text"): vol.All(str, vol.Length(min=1, max=300)),
    vol.Optional("target", default="all"): vol.Any("all", [str]),
})
@websocket_api.require_admin
@callback
def ws_app_message(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Un aviso del instalador en la pantalla de la app (los equipos con la app abierta lo ven al instante)."""
    ad = _rt_devices(hass)
    target = msg["target"]
    ids = list(ad.online) if (ad and target == "all") else [t for t in (target if isinstance(target, list) else []) if ad and ad.online.get(t)]
    fire_command(hass, "hello", target, message=" ".join(msg["text"].split()))
    from .audit import log as audit_log  # noqa: PLC0415

    audit_log(hass, "access", "mensaje a la app", "todos" if target == "all" else f"{len(target)} equipos", "instalador")
    connection.send_result(msg["id"], {"ok": True, "online": len(ids)})


WS_COMMANDS = (ws_app_me, ws_app_actions, ws_app_devices, ws_app_device_set, ws_app_subscribe, ws_app_notify_action, ws_app_test, ws_app_message)


@callback
def fire_command(hass: HomeAssistant, command: str, target: Any = "all", **data: Any) -> None:
    hass.bus.async_fire(EVENT_COMMAND, {"id": uuid.uuid4().hex, "command": command, "target": target or "all", **data})


@callback
def async_register_service(hass: HomeAssistant) -> None:
    if hass.services.has_service(DOMAIN, "app_command"):
        return

    async def _svc(call: ServiceCall) -> None:
        data = dict(call.data)
        fire_command(hass, data.pop("command"), data.pop("target", "all"), **data)

    hass.services.async_register(DOMAIN, "app_command", _svc, schema=vol.Schema({
        vol.Required("command"): vol.In(COMMANDS),
        vol.Optional("target", default="all"): vol.Any("all", cv.ensure_list),
        vol.Optional("path"): cv.string,
        vol.Optional("entity_id"): cv.entity_id,
        vol.Optional("value"): vol.Coerce(float),
        vol.Optional("message"): cv.string,
    }))
