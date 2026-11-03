"""Copias de seguridad, plantillas y órdenes del panel central.

- Copia: el dashboard de la app + las automatizaciones + sus ajustes. Se manda sola al panel
  central cuando cambia algo (el panel no guarda dos iguales) y se puede bajar o restaurar
  desde el panel MatterAI.
- Plantillas: un paquete de automatizaciones o un diseño de dashboard que se guarda en el
  panel central y se usa en otra casa. Las automatizaciones llegan pausadas hasta revisar los
  equipos de la casa nueva.
- Órdenes del panel central (llegan con la respuesta de cada latido): hacer una copia,
  restaurar una copia y actualizar MatterAI (por HACS) y reiniciar.

Nunca viajan las claves de la casa ni el acceso de la app.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
from typing import Any

import aiohttp

from homeassistant.const import __version__ as HA_VERSION
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import DOMAIN, VERSION

_LOGGER = logging.getLogger(__name__)

FORMAT = 1
ESCENAS = "matterai_escenas"  # hass.data del motor de automatizaciones
LOCAL_KEY = f"{DOMAIN}.backup_local"


class BackupError(HomeAssistantError):
    """Mensaje pensado para el instalador."""


def _manager(hass: HomeAssistant):
    manager = hass.data.get(ESCENAS)
    if manager is None:
        raise BackupError("Las automatizaciones todavía están iniciando: probá en un momento")
    return manager


def collect(hass: HomeAssistant) -> tuple[dict[str, Any], dict[str, Any]]:
    """(datos, resumen) de la copia de esta casa."""
    rt = hass.data.get(DOMAIN, {})
    dashboard = rt.get("dashboard")
    manager = hass.data.get(ESCENAS)
    data = {
        "format": FORMAT,
        "created": dt_util.utcnow().isoformat(),
        "version": VERSION,
        "ha_version": HA_VERSION,
        "dashboard": dict(dashboard.config) if dashboard else None,
        "automations": {"rules": manager.export_rules(), "settings": dict(manager.settings)} if manager else None,
    }
    summary = {
        "version": VERSION,
        "automations": len(manager.rules) if manager else 0,
        "dashboard": bool(dashboard and dashboard.config),
    }
    return data, summary


def fingerprint(data: dict[str, Any]) -> str:
    """Huella de lo que importa (sin la fecha): si no cambió, no hace falta mandar otra copia."""
    body = {k: v for k, v in data.items() if k not in ("created",)}
    return hashlib.sha256(json.dumps(body, sort_keys=True, ensure_ascii=False, default=str).encode()).hexdigest()


def validate(data: Any) -> dict[str, Any]:
    if not isinstance(data, dict) or data.get("format") != FORMAT:
        raise BackupError("Ese archivo no es una copia de MatterAI")
    autos = data.get("automations")
    if autos is not None and not (isinstance(autos, dict) and isinstance(autos.get("rules"), list)):
        raise BackupError("La copia está dañada (automatizaciones)")
    if data.get("dashboard") is not None and not isinstance(data["dashboard"], dict):
        raise BackupError("La copia está dañada (dashboard)")
    return data


async def async_apply(hass: HomeAssistant, data: dict[str, Any]) -> dict[str, Any]:
    """Restaura una copia. Antes guarda en la casa cómo estaba (por si hay que volver atrás)."""
    data = validate(data)
    current, _ = collect(hass)
    await Store(hass, 1, LOCAL_KEY).async_save({"saved": dt_util.utcnow().isoformat(), "data": current})
    rt = hass.data.get(DOMAIN, {})
    out: dict[str, Any] = {"dashboard": False, "automations": None}
    if data.get("dashboard") is not None and rt.get("dashboard"):
        await rt["dashboard"].async_save(data["dashboard"])
        out["dashboard"] = True
    if data.get("automations") is not None:
        out["automations"] = await _manager(hass).async_restore(data["automations"]["rules"], data["automations"].get("settings"))
    return out


async def async_undo(hass: HomeAssistant) -> dict[str, Any]:
    """Vuelve a como estaba antes de la última restauración."""
    saved = await Store(hass, 1, LOCAL_KEY).async_load()
    if not saved or not saved.get("data"):
        raise BackupError("No hay una restauración para deshacer")
    return await async_apply(hass, saved["data"])


# ------------------------------------------------------------------ plantillas
def template_automations(hass: HomeAssistant, rule_ids: list[str]) -> tuple[dict[str, Any], dict[str, Any]]:
    manager = _manager(hass)
    rules = manager.export_rules(rule_ids, template=True)
    if not rules:
        raise BackupError("Elegí al menos una automatización")
    kinds = sorted({r.get("kind") for r in rules})
    return {"format": FORMAT, "rules": rules}, {"count": len(rules), "kinds": kinds, "version": VERSION}


def template_dashboard(hass: HomeAssistant) -> tuple[dict[str, Any], dict[str, Any]]:
    dashboard = hass.data.get(DOMAIN, {}).get("dashboard")
    if not dashboard or not dashboard.config:
        raise BackupError("Todavía no hay un dashboard guardado")
    return {"format": FORMAT, "config": dict(dashboard.config)}, {"version": VERSION}


async def async_use_automations(hass: HomeAssistant, data: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(data, dict) or not isinstance(data.get("rules"), list):
        raise BackupError("Esa plantilla no trae automatizaciones")
    res = await _manager(hass).async_import(data["rules"])
    res["candidates"] = candidates(hass, res["missing"])
    return res


def candidates(hass: HomeAssistant, missing: list[str]) -> dict[str, list[dict[str, str]]]:
    """Para cada equipo que falta, los de esta casa del mismo tipo (para emparejarlos)."""
    out: dict[str, list[dict[str, str]]] = {}
    for eid in missing:
        domain = eid.split(".")[0]
        out[eid] = sorted(
            ({"id": s.entity_id, "name": s.name or s.entity_id} for s in hass.states.async_all(domain)),
            key=lambda x: x["name"].lower(),
        )[:300]
    return out


async def async_remap(hass: HomeAssistant, rule_ids: list[str], mapping: dict[str, str]) -> dict[str, Any]:
    known = set(hass.states.async_entity_ids())
    bad = [v for v in mapping.values() if v and v not in known]
    if bad:
        raise BackupError(f"Esos equipos no existen en esta casa: {', '.join(bad)}")
    return await _manager(hass).async_remap(rule_ids, mapping)


async def async_restore_some(hass: HomeAssistant, data: dict[str, Any], rule_ids: list[str]) -> int:
    data = validate(data)
    rules = [r for r in (data.get("automations") or {}).get("rules", []) if isinstance(r, dict) and r.get("id") in set(rule_ids)]
    if not rules:
        raise BackupError("Elegí al menos una automatización de la copia")
    return await _manager(hass).async_restore_some(rules)


# ------------------------------------------------------------------ panel central
class Central:
    """Cliente del panel central con la clave de esta casa."""

    def __init__(self, hass: HomeAssistant, url: str, key: str) -> None:
        self.hass = hass
        self.url = url.rstrip("/")
        self.key = key
        self.last_hash: str | None = None
        self.last_backup: str | None = None
        self.last_error: str | None = None

    async def _req(self, method: str, path: str, payload: Any = None, timeout: int = 30) -> Any:
        session = async_get_clientsession(self.hass)
        try:
            async with asyncio.timeout(timeout):
                resp = await session.request(method, f"{self.url}{path}", json=payload, headers={"Authorization": f"Bearer {self.key}"})
                try:
                    body = await resp.json(content_type=None)
                except (ValueError, aiohttp.ContentTypeError):
                    body = {}
                if resp.status >= 300:
                    raise BackupError(f"Panel central: {body.get('error') if isinstance(body, dict) else ''} (HTTP {resp.status})")
                return body
        except (aiohttp.ClientError, TimeoutError) as err:
            raise BackupError(f"No hay conexión con el panel central ({err or type(err).__name__})") from err

    async def async_backup(self, reason: str = "automática", force: bool = False) -> bool:
        """Manda la copia si cambió algo desde la última (o si se pide). True si la mandó."""
        data, summary = collect(self.hass)
        fp = fingerprint(data)
        if not force and fp == self.last_hash:
            return False
        try:
            await self._req("POST", "/api/backup", {"reason": reason, "summary": summary, "data": data, "force": force}, timeout=60)
        except BackupError as err:
            self.last_error = str(err)
            _LOGGER.warning("No se pudo mandar la copia: %s", err)
            if force:
                raise
            return False
        self.last_hash = fp
        self.last_backup = dt_util.utcnow().isoformat()
        self.last_error = None
        return True

    async def async_get_backup(self, backup_id: int) -> dict[str, Any]:
        body = await self._req("GET", f"/api/backup/{int(backup_id)}", timeout=60)
        return body.get("data") or {}

    async def async_templates(self, kind: str | None = None) -> list[dict[str, Any]]:
        body = await self._req("GET", "/api/templates" + (f"?kind={kind}" if kind else ""))
        return body.get("templates") or []

    async def async_template(self, template_id: str) -> dict[str, Any]:
        return await self._req("GET", f"/api/templates/{template_id}", timeout=60)

    async def async_save_template(self, kind: str, name: str, description: str, data: dict[str, Any], summary: dict[str, Any]) -> str:
        body = await self._req("POST", "/api/templates", {"kind": kind, "name": name, "description": description, "data": data, "summary": summary}, timeout=60)
        return body.get("id", "")


# ------------------------------------------------------------------ órdenes del panel central
def _matterai_update_entity(hass: HomeAssistant) -> str | None:
    """La actualización de MatterAI que crea HACS."""
    for state in hass.states.async_all("update"):
        title = str(state.attributes.get("title") or "").strip().lower()
        if title == "matterai" or state.entity_id.startswith("update.matterai"):
            return state.entity_id
    return None


async def async_run_command(hass: HomeAssistant, central: Central, cmd: dict[str, Any]) -> dict[str, Any] | None:
    """Ejecuta una orden y devuelve el resultado para informarlo en el próximo latido."""
    name = cmd.get("command")
    try:
        if name == "heartbeat":
            return None  # el latido ya es la respuesta
        if name == "backup":
            await central.async_backup("pedida desde el panel", force=True)
            return {"command": name, "ok": True, "message": "Copia guardada"}
        if name == "restore":
            data = await central.async_get_backup(int(cmd.get("backup_id")))
            res = await async_apply(hass, data)
            await central.async_backup("después de restaurar", force=True)
            return {"command": name, "ok": True, "message": f"Restaurada: {res['automations'] or 0} automatizaciones{' y el dashboard' if res['dashboard'] else ''}"}
        if name == "update":
            return await _async_update(hass, central)
        if name == "maintenance":
            wd = hass.data.get(DOMAIN, {}).get("watchdog")
            if wd is None:
                return {"command": name, "ok": False, "message": "El mantenimiento del sistema no está disponible"}
            minutes = int(cmd.get("minutes") or 0)
            await wd.async_set_maintenance(minutes or None)
            return {"command": name, "ok": True, "message": f"Mantenimiento por {minutes} min" if minutes else "Mantenimiento terminado"}
        return {"command": name, "ok": False, "message": "Orden desconocida"}
    except Exception as err:  # noqa: BLE001 - se informa al panel central
        _LOGGER.warning("Orden «%s» del panel central: %s", name, err)
        return {"command": name, "ok": False, "message": str(err)[:300]}


async def _async_update(hass: HomeAssistant, central: Central) -> dict[str, Any]:
    entity_id = _matterai_update_entity(hass)
    if not entity_id:
        return {"command": "update", "ok": False, "message": "No encontré la actualización de MatterAI: ¿está instalada desde HACS?"}
    await hass.services.async_call("homeassistant", "update_entity", {"entity_id": entity_id}, blocking=True)
    state = hass.states.get(entity_id)
    if state is None or state.state != "on":
        return {"command": "update", "ok": True, "message": f"Ya está en la última versión ({VERSION})"}
    target = state.attributes.get("latest_version")
    await central.async_backup("antes de actualizar", force=True)
    await hass.services.async_call("update", "install", {"entity_id": entity_id}, blocking=True)
    # HACS deja los archivos nuevos: hace falta reiniciar para usarlos
    hass.async_create_task(_restart_soon(hass))
    return {"command": "update", "ok": True, "message": f"Actualizada a {target or 'la última versión'}; reiniciando Home Assistant"}


async def _restart_soon(hass: HomeAssistant) -> None:
    await asyncio.sleep(20)  # tiempo para informar el resultado al panel central
    await hass.services.async_call("homeassistant", "restart", {}, blocking=False)
