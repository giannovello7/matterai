"""Estado de la casa para el panel central del instalador.

Cada pocos minutos la casa le cuenta al panel central que está viva, qué versión tiene
y qué hay para atender. Cada aviso lleva una clave estable («key»): así el panel central
sabe cuándo un problema es nuevo, cuándo sigue y cuándo se resolvió, y avisa una sola vez.

Qué se revisa:
- equipos sin responder (más de 15 minutos, así un corte corto no molesta);
- complementos (add-ons) que tendrían que estar andando y no andan;
- integraciones que no arrancan (Zigbee2MQTT, MQTT, Tuya…);
- reparaciones que pide Home Assistant (errores y críticas);
- disco casi lleno, pilas bajas, alarma disparada;
- copias de seguridad de Home Assistant viejas y actualizaciones pendientes.

La respuesta de cada latido trae las órdenes del instalador (copia, restaurar, actualizar):
se ejecutan y el resultado viaja en el latido siguiente (que sale en el momento).
Cada 15 minutos, si cambió el dashboard o las automatizaciones, manda una copia.
"""

from __future__ import annotations

import asyncio
from datetime import timedelta
import logging
from typing import Any

import aiohttp

from homeassistant.config_entries import ConfigEntryState
from homeassistant.const import __version__ as HA_VERSION
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers import issue_registry as ir
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.util import dt as dt_util

from .backup import Central, async_run_command
from .const import DOMAIN, HEARTBEAT_MINUTES, VERSION

_LOGGER = logging.getLogger(__name__)

SKIP_DOMAINS = {"update", "button", "event", "scene", "script", "automation", "zone", "sun", "conversation", "tts", "stt", "wake_word", "assist_satellite"}
UNAVAILABLE_FOR = timedelta(minutes=15)  # recién ahí cuenta como «sin responder»
MAX_ITEMS = 8  # más que esto se agrupa en un solo aviso
BACKUP_OLD_DAYS = 7
FAILED_ENTRY_STATES = {ConfigEntryState.SETUP_ERROR, ConfigEntryState.SETUP_RETRY, ConfigEntryState.MIGRATION_ERROR, ConfigEntryState.FAILED_UNLOAD}


def _alert(level: str, key: str, text: str) -> dict[str, str]:
    return {"level": level, "key": key[:120], "text": text[:300]}


@callback
def collect(hass: HomeAssistant) -> dict[str, Any]:
    """Resumen y avisos que se calculan al instante (sin consultar al Supervisor)."""
    ent_reg = er.async_get(hass)
    dev_reg = dr.async_get(hass)
    now = dt_util.utcnow()
    alerts: list[dict[str, str]] = []
    unavailable: dict[str, str] = {}
    unavailable_recent = 0
    low_batt: list[tuple[str, str]] = []
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
            if now - state.last_changed < UNAVAILABLE_FOR:
                unavailable_recent += 1
                continue
            dev = dev_reg.async_get(entry.device_id) if entry and entry.device_id else None
            key = dev.id if dev else state.entity_id
            unavailable[key] = (dev.name_by_user or dev.name) if dev else (state.name or state.entity_id)
        if state.attributes.get("device_class") == "battery" and domain == "sensor":
            try:
                if float(state.state) <= 15:
                    low_batt.append((state.entity_id, f"{state.name} ({round(float(state.state))}%)"))
            except ValueError:
                pass
        if domain == "alarm_control_panel" and state.state == "triggered":
            alerts.append(_alert("critical", f"alarm:{state.entity_id}", f"Alarma disparada: {state.name}"))

    # equipos sin responder: uno por equipo (así se sabe cuál volvió), o agrupados si son muchos
    if len(unavailable) > MAX_ITEMS:
        names = sorted(unavailable.values())
        alerts.append(_alert("warning", "unavailable:many", f"{len(names)} equipos sin responder: {', '.join(names[:6])}…"))
    else:
        for key, name in sorted(unavailable.items(), key=lambda kv: kv[1]):
            alerts.append(_alert("warning", f"unavailable:{key}", f"Sin responder: {name}"))
    for entity_id, text in low_batt[:MAX_ITEMS]:
        alerts.append(_alert("info", f"battery:{entity_id}", f"Pila baja: {text}"))

    # integraciones que no arrancan
    for entry in hass.config_entries.async_entries():
        if entry.disabled_by:
            continue
        # «no cargada» con HA ya andando: falta la integración (se borró) o quedó a medio sacar
        not_loaded = entry.state == ConfigEntryState.NOT_LOADED and hass.is_running
        if entry.state not in FAILED_ENTRY_STATES and not not_loaded:
            continue
        reason = getattr(entry, "reason", None)
        what = "no puede conectarse (reintentando)" if entry.state == ConfigEntryState.SETUP_RETRY else "no está cargada" if not_loaded else "no arranca"
        alerts.append(_alert("warning", f"integration:{entry.entry_id}", f"La integración «{entry.title or entry.domain}» {what}{f': {reason}' if reason else ''}"))

    # reparaciones de Home Assistant (errores y críticas; las advertencias no avisan)
    for issue in ir.async_get(hass).issues.values():
        if not issue.active or issue.dismissed_version:
            continue
        sev = str(issue.severity or "")
        if sev not in ("error", "critical"):
            continue
        alerts.append(_alert("critical" if sev == "critical" else "warning", f"repair:{issue.domain}:{issue.issue_id}",
                             f"Home Assistant pide revisar: {issue.domain} · {issue.translation_key or issue.issue_id}"))

    # copias de seguridad de Home Assistant (sensor de la integración backup, HA 2025.1+)
    last = hass.states.get("sensor.backup_last_successful_automatic_backup")
    if last is not None and last.state not in ("unknown", "unavailable"):
        when = dt_util.parse_datetime(last.state)
        if when and now - when > timedelta(days=BACKUP_OLD_DAYS):
            alerts.append(_alert("warning", "ha_backup", f"La última copia automática de Home Assistant es de hace {(now - when).days} días"))

    updates = [s for s in hass.states.async_all("update") if s.state == "on"]
    if updates:
        alerts.append(_alert("info", "updates", f"{len(updates)} actualización(es) disponibles en Home Assistant"))
    disk = hass.states.get("sensor.disk_use_percent") or hass.states.get("sensor.system_monitor_disk_usage")
    try:
        if disk is not None and float(disk.state) >= 90:
            alerts.append(_alert("warning", "disk", f"Disco casi lleno ({disk.state}%)"))
    except ValueError:
        pass
    if hass.config_entries.async_entries("matterai_escenas"):
        alerts.append(_alert("warning", "escenas_aparte", "Falta eliminar la integración vieja «MatterAI Escenas» (las automatizaciones ya vienen en MatterAI)"))
    manager = hass.data.get("matterai_escenas")
    return {
        "version": VERSION,
        "ha_version": HA_VERSION,
        "alerts": alerts,
        "stats": {"entities": total, "unavailable": len(unavailable), "unavailable_recent": unavailable_recent, "lights_on": lights_on,
                  "automations": len(manager.rules) if manager else None},
    }


async def async_collect(hass: HomeAssistant) -> dict[str, Any]:
    """Todo lo de collect() más lo que hay que preguntarle al Supervisor (complementos, disco)."""
    data = collect(hass)
    wd = hass.data.get(DOMAIN, {}).get("watchdog")
    try:
        managed = wd.managed_slugs() if wd else set()
        # los complementos que cuida el watchdog avisan por él (con los intentos y el motivo), no dos veces
        data["alerts"] += [a for a in await _async_supervisor_alerts(hass) if a["key"].split(":", 1)[-1] not in managed]
    except Exception:  # noqa: BLE001 - sin Supervisor (HA Core/Container) o API distinta: se saltea
        _LOGGER.debug("No se pudo consultar al Supervisor", exc_info=True)
    if wd:
        # las integraciones que vigila el watchdog avisan por él; a las demás se les suma lo que ya intentó
        managed, recs = wd.managed_entries(), wd.data.get("integrations", {})
        alerts = []
        for a in data["alerts"]:
            kind, _, entry_id = a["key"].partition(":")
            if kind == "integration" and entry_id in managed:
                continue
            if kind == "integration" and recs.get(entry_id, {}).get("attempts"):
                n = recs[entry_id]["attempts"]
                a = {**a, "text": f"{a['text']} (MatterAI la recargó {n} {'vez' if n == 1 else 'veces'} sin éxito)"}
            alerts.append(a)
        data["alerts"] = alerts + wd.alerts()
        if wd.maintenance:
            data["stats"]["maintenance"] = True
    return data


async def _async_supervisor_alerts(hass: HomeAssistant) -> list[dict[str, str]]:
    from homeassistant.helpers.hassio import is_hassio  # noqa: PLC0415

    if not is_hassio(hass) or "hassio" not in hass.config.components:
        return []
    from homeassistant.components.hassio import get_supervisor_client  # noqa: PLC0415

    client = get_supervisor_client(hass)
    alerts: list[dict[str, str]] = []
    for addon in await client.addons.list():
        state = str(addon.state)
        if state in ("started", "startup"):
            continue
        if state == "error":
            alerts.append(_alert("warning", f"addon:{addon.slug}", f"El complemento «{addon.name}» falló y no está andando"))
            continue
        # detenido: sólo importa si está configurado para arrancar solo
        try:
            info = await client.addons.addon_info(addon.slug)
        except Exception:  # noqa: BLE001
            continue
        if str(getattr(info, "boot", "")) == "auto":
            alerts.append(_alert("warning", f"addon:{addon.slug}", f"El complemento «{addon.name}» está detenido (debería arrancar solo)"))
    try:
        host = await client.host.info()
        if host.disk_total and host.disk_used / host.disk_total >= 0.9:
            alerts.append(_alert("warning", "disk", f"Disco casi lleno ({round(host.disk_used / host.disk_total * 100)}%, quedan {host.disk_free:.1f} GB)"))
    except Exception:  # noqa: BLE001
        pass
    return alerts


class Heartbeat:
    def __init__(self, hass: HomeAssistant, house_id: str, name: str, url: str, central_url: str, key: str) -> None:
        self.hass = hass
        self.house_id = house_id
        self.name = name
        self.url = url
        self.central_url = central_url.rstrip("/")
        self.key = key
        self.central = Central(hass, central_url, key)
        self.last_ok: bool | None = None
        self.last_error: str | None = None
        self.latest: str | None = None
        self._result: dict[str, Any] | None = None
        self._ticks = 0
        self._busy = False
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
        self._ticks += 1
        if self._ticks % 3 == 1:  # al arrancar y cada 15 min: copia si algo cambió
            await self.central.async_backup()

    async def async_send(self) -> bool:
        payload = {"house_id": self.house_id, "name": self.name, "url": self.url, **await async_collect(self.hass)}
        if self._result:
            payload["result"] = self._result
        session = async_get_clientsession(self.hass)
        commands: list[dict[str, Any]] = []
        try:
            async with asyncio.timeout(15):
                resp = await session.post(
                    f"{self.central_url}/api/heartbeat",
                    json=payload,
                    headers={"Authorization": f"Bearer {self.key}"},
                )
                ok = resp.status < 300
                self.last_error = None if ok else f"HTTP {resp.status}"
                if ok:
                    try:
                        body = await resp.json(content_type=None)
                    except (ValueError, aiohttp.ContentTypeError):
                        body = {}
                    if isinstance(body, dict):
                        self.latest = body.get("latest") or self.latest
                        commands = [c for c in body.get("commands") or [] if isinstance(c, dict)]
        except (aiohttp.ClientError, TimeoutError) as err:
            ok = False
            self.last_error = str(err) or type(err).__name__
        if ok != self.last_ok:
            (_LOGGER.info if ok else _LOGGER.warning)("Panel central: %s", "conectado" if ok else f"sin conexión ({self.last_error})")
        self.last_ok = ok
        if ok and "result" in payload:
            self._result = None  # ya lo recibió
        if commands and not self._busy:
            self.hass.async_create_background_task(self._async_commands(commands), "matterai_central_commands")
        return ok

    async def _async_commands(self, commands: list[dict[str, Any]]) -> None:
        self._busy = True
        try:
            for cmd in commands:
                result = await async_run_command(self.hass, self.central, cmd)
                if result:
                    self._result = result
                    await self.async_send()  # informa el resultado ya (antes de un reinicio)
        finally:
            self._busy = False
