"""Registro de auditoría de la casa y acceso del instalador.

Registro (append-only, encadenado con hashes):
- Acciones críticas: cerraduras, alarma y portones/garajes (quién: equipo de la app, instalador o automatización).
- Cámaras vistas desde la app (la app lo avisa con matterai_app_action · camera.view).
- Vinculación: equipos nuevos, pasados del acceso compartido, desvinculados, perfiles cambiados.
- Acceso del instalador: cada vez que un administrador usa Home Assistant (se detecta por el último uso de su acceso).
Cada entrada guarda el hash de la anterior: si alguien la cambia o borra a mano en .storage, la verificación lo detecta.
Se guardan las últimas MAX_ENTRIES; al recortar queda el hash de la última descartada como punto de partida.

Acceso del instalador (opcional, por casa, para el cliente que lo pida):
- «Permanente» (lo normal): el instalador entra cuando necesita. Queda registrado y, si se activa
  «avisar al cliente», la app del cliente recibe un aviso cuando entra.
- «Lo habilita el dueño»: el usuario de soporte (un administrador aparte del dueño de HA) queda desactivado y
  el cliente lo habilita desde la app por 2 h, 24 h o 7 días. Se desactiva solo al vencer.
  La cuenta dueña de HA queda como llave de emergencia (guardada por el instalador, fuera de línea).
"""

from __future__ import annotations

from datetime import timedelta
import hashlib
import json
import logging
import time
from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.const import EVENT_CALL_SERVICE
from homeassistant.core import Event, HomeAssistant, callback
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.helpers.storage import Store

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

STORAGE_KEY = f"{DOMAIN}.audit"
MAX_ENTRIES = 5000
GATE_CLASSES = ("gate", "garage")
CRITICAL = {
    "lock": ("unlock", "open", "lock"),
    "alarm_control_panel": ("alarm_disarm", "alarm_arm_away", "alarm_arm_home", "alarm_arm_night", "alarm_arm_vacation", "alarm_trigger"),
    "cover": ("open_cover", "close_cover", "toggle", "set_cover_position", "stop_cover"),
}
GRANT_HOURS = (2, 24, 168)
WATCH_EVERY = timedelta(minutes=2)
SESSION_GAP = 3 * 3600  # sin usar HA 3 horas = la próxima vez es una entrada nueva


def _chain(prev: str, e: dict[str, Any]) -> str:
    body = json.dumps({k: e[k] for k in ("t", "who", "kind", "what", "target", "detail")}, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(f"{prev}|{body}".encode()).hexdigest()


class Audit:
    """Registro de auditoría + acceso del instalador (lo guarda todo en .storage, privado)."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store: Store = Store(hass, 1, STORAGE_KEY, private=True)
        self.entries: list[dict[str, Any]] = []
        self.anchor = ""
        self.support: dict[str, Any] = {"mode": "always", "user_id": None, "notify": False, "until": 0}
        self.seen: dict[str, float] = {}  # último uso conocido del acceso de cada administrador
        self._unsubs: list = []

    async def async_load(self) -> None:
        data = await self._store.async_load() or {}
        self.entries = data.get("entries") or []
        self.anchor = data.get("anchor") or ""
        self.support.update(data.get("support") or {})
        self.seen = data.get("seen") or {}

    def _save(self) -> None:
        self._store.async_delay_save(lambda: {"entries": self.entries, "anchor": self.anchor, "support": self.support, "seen": self.seen}, 5)

    # ------------------------------------------------------------ registro
    @callback
    def add(self, kind: str, what: str, target: str = "", who: str = "", detail: str = "") -> dict[str, Any]:
        e = {"t": round(time.time(), 3), "who": str(who)[:60], "kind": kind, "what": str(what)[:80], "target": str(target)[:120], "detail": str(detail)[:300]}
        prev = self.entries[-1]["h"] if self.entries else self.anchor
        e["h"] = _chain(prev, e)
        self.entries.append(e)
        if len(self.entries) > MAX_ENTRIES:
            cut = len(self.entries) - MAX_ENTRIES
            self.anchor = self.entries[cut - 1]["h"]
            self.entries = self.entries[cut:]
        self._save()
        return e

    def verify(self) -> dict[str, Any]:
        prev = self.anchor
        for i, e in enumerate(self.entries):
            if _chain(prev, e) != e.get("h"):
                return {"ok": False, "broken_at": i, "rows": len(self.entries)}
            prev = e["h"]
        return {"ok": True, "rows": len(self.entries)}

    async def _who(self, user_id: str | None) -> str:
        if not user_id:
            return "automatización"
        house = (self.hass.data.get(DOMAIN) or {}).get("house")
        if house is not None and house.is_device_user(user_id):
            return f"app · {house.devices[user_id].get('name')}"
        if house is not None and house.is_shared_user(user_id):
            return "app (acceso compartido)"
        user = await self.hass.auth.async_get_user(user_id)
        if user is None:
            return "usuario borrado"
        return f"{'instalador' if user.is_admin else 'usuario'} · {user.name}"

    async def _on_service(self, event: Event) -> None:
        d = event.data or {}
        domain, service = d.get("domain"), d.get("service")
        if service not in CRITICAL.get(domain, ()):
            return
        sd = d.get("service_data") or {}
        ids = sd.get("entity_id") or []
        ids = [ids] if isinstance(ids, str) else list(ids)
        if domain == "cover":  # sólo portones y garajes (no cortinas)
            ids = [i for i in ids if (s := self.hass.states.get(i)) and s.attributes.get("device_class") in GATE_CLASSES]
            if not ids:
                return
        who = await self._who(event.context.user_id if event.context else None)
        self.add("critical", f"{domain}.{service}", ", ".join(ids) or "(todos)", who)

    async def _on_app(self, event: Event) -> None:
        d = event.data or {}
        if d.get("service") != "camera.view":
            return
        ids = d.get("entity_id") or []
        self.add("camera", "cámara vista", ", ".join(ids if isinstance(ids, list) else [ids]), f"app · {d.get('device') or 'equipo'}")

    # ------------------------------------------------------------ acceso del instalador
    async def _watch_admins(self, _now=None) -> None:
        """¿Un administrador usó Home Assistant? (último uso de su acceso). Lo registra y, si se pidió, avisa."""
        changed = False
        for user in await self.hass.auth.async_get_users():
            if user.system_generated or not user.is_admin:
                continue
            for rt in user.refresh_tokens.values():
                last = rt.last_used_at.timestamp() if rt.last_used_at else 0
                prev = self.seen.get(rt.id, 0)
                if last and last > prev + 1:
                    self.seen[rt.id] = last
                    changed = True
                    if not prev or last - prev > SESSION_GAP:  # una entrada nueva (no cada renovación del acceso, que es cada 30 min)
                        self.add("support", "acceso del instalador", user.name or "", f"instalador · {user.name}", f"desde {rt.last_used_ip or '?'} ({rt.client_name or rt.client_id or 'navegador'})")
                        if self.support.get("notify"):
                            await self._notify_client(f"Tu instalador entró al sistema de tu casa ({user.name}).")
        # vencimiento del acceso que dio el dueño
        if self.support.get("mode") == "owner" and self.support.get("until") and self.support["until"] < time.time():
            self.support["until"] = 0
            await self._apply_support()
            self.add("support", "acceso del instalador vencido", "", "sistema")
            changed = True
        if changed:
            self._save()

    async def _notify_client(self, text: str) -> None:
        from .escenas.notify import app_targets  # noqa: PLC0415

        for target in app_targets(self.hass):
            try:
                await self.hass.services.async_call("notify", target, {"title": "MatterAI", "message": text}, blocking=False)
            except Exception:  # noqa: BLE001 - un aviso que no sale no puede romper nada
                _LOGGER.debug("No se pudo avisar a %s", target, exc_info=True)

    def support_status(self) -> dict[str, Any]:
        s = self.support
        return {"mode": s.get("mode", "always"), "notify": bool(s.get("notify")), "user_id": s.get("user_id"),
                "until": s.get("until") or 0, "open": s.get("mode") != "owner" or (s.get("until") or 0) > time.time()}

    async def _apply_support(self) -> None:
        """Modo «lo habilita el dueño»: el usuario de soporte activo sólo mientras haya permiso."""
        s = self.support
        if s.get("mode") != "owner" or not s.get("user_id"):
            return
        user = await self.hass.auth.async_get_user(s["user_id"])
        if user is None or user.is_owner:
            return  # nunca se desactiva la cuenta dueña (llave de emergencia)
        want = (s.get("until") or 0) > time.time()
        if user.is_active != want:
            if want:
                await self.hass.auth.async_activate_user(user)
            else:
                await self.hass.auth.async_deactivate_user(user)

    async def async_set_support(self, mode: str, user_id: str | None, notify: bool) -> None:
        if mode == "owner":
            user = await self.hass.auth.async_get_user(user_id or "")
            if user is None or not user.is_admin or user.is_owner:
                raise ValueError("Elegí un usuario administrador de soporte que no sea el dueño de Home Assistant (la cuenta dueña queda como llave de emergencia)")
        old = dict(self.support)
        if old.get("mode") == "owner" and mode != "owner" and old.get("user_id"):
            user = await self.hass.auth.async_get_user(old["user_id"])
            if user is not None and not user.is_active:
                await self.hass.auth.async_activate_user(user)
        self.support.update(mode=mode, user_id=user_id if mode == "owner" else None, notify=bool(notify), until=0)
        await self._apply_support()
        self.add("support", "cambio del acceso del instalador", "", "instalador", f"modo {mode}{' · avisar al cliente' if notify else ''}")
        self._save()

    async def async_grant(self, hours: float, who: str) -> None:
        self.support["until"] = time.time() + hours * 3600 if hours > 0 else 0
        await self._apply_support()
        self.add("support", "acceso del instalador habilitado" if hours > 0 else "acceso del instalador cortado", "", who, f"{hours:g} h" if hours > 0 else "")
        self._save()

    # ------------------------------------------------------------ arranque
    def start(self) -> None:
        self._unsubs.append(self.hass.bus.async_listen(EVENT_CALL_SERVICE, self._on_service))
        self._unsubs.append(self.hass.bus.async_listen(f"{DOMAIN}_app_action", self._on_app))
        self._unsubs.append(async_track_time_interval(self.hass, self._watch_admins, WATCH_EVERY))
        self.hass.async_create_background_task(self._apply_support(), "matterai_support")

    def stop(self) -> None:
        for u in self._unsubs:
            u()
        self._unsubs.clear()


def _audit(hass: HomeAssistant) -> Audit | None:
    return (hass.data.get(DOMAIN) or {}).get("audit")


@callback
def log(hass: HomeAssistant, kind: str, what: str, target: str = "", who: str = "", detail: str = "") -> None:
    """Para el resto de la integración: anotar algo en el registro (si está andando)."""
    a = _audit(hass)
    if a is not None:
        a.add(kind, what, target, who, detail)


# ---------------------------------------------------------------- comandos
@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/audit", vol.Optional("limit", default=500): vol.All(int, vol.Range(min=1, max=MAX_ENTRIES))})
@websocket_api.require_admin
@callback
def ws_audit(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    a = _audit(hass)
    if a is None:
        connection.send_error(msg["id"], "not_setup", "La integración MatterAI no está configurada")
        return
    connection.send_result(msg["id"], {"entries": list(reversed(a.entries[-msg["limit"]:])), "integrity": a.verify(), "support": a.support_status()})


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/support/set",
    vol.Required("mode"): vol.In(["always", "owner"]),
    vol.Optional("user_id"): vol.Any(str, None),
    vol.Optional("notify", default=False): bool,
})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_support_set(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    a = _audit(hass)
    try:
        await a.async_set_support(msg["mode"], msg.get("user_id"), msg["notify"])
    except ValueError as err:
        connection.send_error(msg["id"], "invalid", str(err))
        return
    connection.send_result(msg["id"], a.support_status())


def _client_ok(hass: HomeAssistant, connection, device_id: str) -> bool:
    """Un equipo de la casa con perfil completo (o el instalador)."""
    rt = hass.data.get(DOMAIN) or {}
    house, ad = rt.get("house"), rt.get("app_devices")
    if connection.user.is_admin:
        return True
    if house is None or not house.is_app_user(connection.user.id):
        return False
    return ad is None or not device_id or ad.profile(device_id)["profile"] == "full"


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/app/support", vol.Optional("device_id", default=""): str})
@callback
def ws_app_support(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Para la app: cómo es el acceso del instalador en esta casa."""
    a = _audit(hass)
    if a is None or not _client_ok(hass, connection, msg["device_id"]):
        connection.send_error(msg["id"], "unauthorized", "Este equipo no puede ver esto")
        return
    st = a.support_status()
    connection.send_result(msg["id"], {"mode": st["mode"], "open": st["open"], "until": st["until"], "notify": st["notify"]})


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/app/support_grant",
    vol.Required("hours"): vol.In([0, *GRANT_HOURS]),
    vol.Optional("device_id", default=""): str,
})
@websocket_api.async_response
async def ws_app_support_grant(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """El dueño habilita (2 h, 24 h, 7 días) o corta (0) el acceso del instalador. Sólo en el modo «lo habilita el dueño»."""
    a = _audit(hass)
    if a is None or connection.user.is_admin or not _client_ok(hass, connection, msg["device_id"]):
        connection.send_error(msg["id"], "unauthorized", "Esto lo decide un equipo de la casa con perfil completo")
        return
    if a.support.get("mode") != "owner":
        connection.send_error(msg["id"], "not_owner_mode", "En esta casa el acceso del instalador es permanente")
        return
    house = (hass.data.get(DOMAIN) or {}).get("house")
    who = f"app · {house.devices.get(connection.user.id, {}).get('name', 'equipo')}" if house else "app"
    await a.async_grant(float(msg["hours"]), who)
    connection.send_result(msg["id"], a.support_status())


WS_COMMANDS = (ws_audit, ws_support_set, ws_app_support, ws_app_support_grant)
