"""Sensores del mantenimiento del sistema (estado de cada servicio vigilado)."""

from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .watchdog_entities import async_setup_watchdog_platform


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities) -> None:
    async_setup_watchdog_platform(hass, entry, async_add_entities, "sensor")
