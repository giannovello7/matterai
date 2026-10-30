"""Estado de la casa para el panel central del instalador.

Cada pocos minutos la casa le cuenta al panel central que está viva, qué versión tiene
y si hay algo para atender (equipos que no responden, pilas bajas, alarma disparada…).
Si el panel deja de recibir latidos, avisa que la casa está sin conexión.
"""

from __future__ import annotations

import asyncio
from datetime import timedelta
import logging
from typing import Any

import aiohttp

from homeassistant.const import __version__ as HA_VERSION
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.event import async_track_time_interval

from .const import HEARTBEAT_MINUTES, VERSION

_LOGGER = logging.getLogger(__name__)

SKIP_DOMAINS = {"update", "button", "event", "scene", "script", "automation", "zone", "sun", "conversation", "tts", "stt", "wake_word", "assist_satellite"}


@callback
def collect(hass: HomeAssistant) -> dict[str, Any]:
    """Lo que se le manda al panel central: resumen y alertas (sin datos personales)."""
    ent_reg = er.async_get(hass)
    dev_reg = dr.async_get(hass)
    alerts: list[dict[str, Any]] = []
    unavailable_devices: dict[str, str] = {}
    low_batt: list[str] = []
    lights_on = 0
    total = 0
    for state in hass.states.async_all():
        domain = state.domain
        if domain in SKIP_DOMAINS:
            continue
        entry = ent_reg.async_get(state.entity_id)
        if entry is not None and (entry.hidden or entry.disabled or entry.entity_category):
            continue
        total += 1
        if domain == "light" and state.state == "on":
            lights_on += 1
        if state.state == "unavailable":
            dev = dev_reg.async_get(entry.device_id) if entry and entry.device_id else None
            key = dev.id if dev else state.entity_id
            unavailable_devices[key] = (dev.name_by_user or dev.name) if dev else (state.name or state.entity_id)
        if state.attributes.get("device_class") == "battery" and domain == "sensor":
            try:
                if float(state.state) <= 15:
                    low_batt.append(f"{state.name} ({round(float(state.state))}%)")
            except ValueError:
                pass
        if domain == "alarm_control_panel" and state.state == "triggered":
            alerts.append({"level": "critical", "text": f"Alarma disparada: {state.name}"})
    if unavailable_devices:
        names = sorted(unavailable_devices.values())
        alerts.append({"level": "warning", "text": f"{len(names)} equipo(s) sin responder: {', '.join(names[:6])}{'…' if len(names) > 6 else ''}"})
    if low_batt:
        alerts.append({"level": "info", "text": f"Pilas bajas: {', '.join(low_batt[:6])}{'…' if len(low_batt) > 6 else ''}"})
    updates = [s for s in hass.states.async_all("update") if s.state == "on"]
    if updates:
        alerts.append({"level": "info", "text": f"{len(updates)} actualización(es) disponibles en Home Assistant"})
    disk = hass.states.get("sensor.disk_use_percent") or hass.states.get("sensor.system_monitor_disk_usage")
    try:
        if disk is not None and float(disk.state) >= 90:
            alerts.append({"level": "warning", "text": f"Disco casi lleno ({disk.state}%)"})
    except ValueError:
        pass
    return {
        "version": VERSION,
        "ha_version": HA_VERSION,
        "alerts": alerts,
        "stats": {"entities": total, "unavailable": len(unavailable_devices), "lights_on": lights_on},
    }


class Heartbeat:
    def __init__(self, hass: HomeAssistant, house_id: str, name: str, url: str, central_url: str, key: str) -> None:
        self.hass = hass
        self.house_id = house_id
        self.name = name
        self.url = url
        self.central_url = central_url.rstrip("/")
        self.key = key
        self.last_ok: bool | None = None
        self.last_error: str | None = None
        self._unsub = None

    def start(self) -> None:
        self._unsub = async_track_time_interval(self.hass, self._tick, timedelta(minutes=HEARTBEAT_MINUTES))
        self.hass.async_create_background_task(self.async_send(), "matterai_heartbeat")

    def stop(self) -> None:
        if self._unsub:
            self._unsub()
            self._unsub = None

    async def _tick(self, _now=None) -> None:
        await self.async_send()

    async def async_send(self) -> bool:
        payload = {"house_id": self.house_id, "name": self.name, "url": self.url, **collect(self.hass)}
        session = async_get_clientsession(self.hass)
        try:
            async with asyncio.timeout(15):
                resp = await session.post(
                    f"{self.central_url}/api/heartbeat",
                    json=payload,
                    headers={"Authorization": f"Bearer {self.key}"},
                )
                ok = resp.status < 300
                self.last_error = None if ok else f"HTTP {resp.status}"
        except (aiohttp.ClientError, TimeoutError) as err:
            ok = False
            self.last_error = str(err) or type(err).__name__
        if ok != self.last_ok:
            (_LOGGER.info if ok else _LOGGER.warning)("Panel central: %s", "conectado" if ok else f"sin conexión ({self.last_error})")
        self.last_ok = ok
        return ok
