"""Permiso (CORS) para que la app MatterAI pueda pedirle cosas a Home Assistant desde el navegador.

Se configura en Ajustes → Sistema → Red → «Orígenes permitidos por CORS».
La integración sólo LEE esa configuración (nunca la escribe: un error ahí deja a HA sin acceso web)
y, si falta algo, el panel MatterAI avisa y lleva a esa pantalla.

Formatos de .storage/http que entiende:
- HA 2025.x: {"cors_allowed_origins": [...], ...}  (copia de la última configuración que anduvo)
- HA 2026.x: {"stable": {...}, "pending": {...} | null}  (pending = guardado, se aplica al reiniciar)
"""

from __future__ import annotations

import json
from typing import Any

from homeassistant.core import HomeAssistant

from .const import APP_ORIGINS

HTTP_STORAGE_KEY = "http"
NETWORK_PAGE = "/config/network"


def _read_file(path: str) -> dict[str, Any]:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


async def _load(hass: HomeAssistant) -> dict[str, Any]:
    """Lee .storage/http directo del disco: nunca pasa por el guardado de HA, así es imposible modificarlo."""
    path = hass.config.path(".storage", HTTP_STORAGE_KEY)
    try:
        raw = await hass.async_add_executor_job(_read_file, path)
    except FileNotFoundError:
        return {}
    except Exception:  # noqa: BLE001 - archivo raro: se informa como desconocido
        return {"_unreadable": True}
    data = raw.get("data") if isinstance(raw, dict) else None
    return data if isinstance(data, dict) else {"_unreadable": True}


def _origins(conf: Any) -> list[str]:
    return list((conf or {}).get("cors_allowed_origins") or []) if isinstance(conf, dict) else []


async def cors_status(hass: HomeAssistant) -> dict[str, Any]:
    data = await _load(hass)
    if data.get("_unreadable"):
        return {"known": False, "missing": [], "needs_restart": False, "page": NETWORK_PAGE}
    if "stable" in data or "pending" in data:
        active, pending = _origins(data.get("stable")), (_origins(data.get("pending")) if data.get("pending") else None)
    else:
        active, pending = _origins(data), None
    target = pending if pending is not None else active
    return {
        "known": True,
        "missing": [o for o in APP_ORIGINS if o not in target],
        "needs_restart": pending is not None and any(o in pending and o not in active for o in APP_ORIGINS),
        "page": NETWORK_PAGE,
        "origins": APP_ORIGINS,
    }
