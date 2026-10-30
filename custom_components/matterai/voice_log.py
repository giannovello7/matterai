"""Frases que el modo gratis no entendió: el instalador las ve en el panel (Estado) para mejorar las reglas."""

from __future__ import annotations

from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import DOMAIN

MAX_ITEMS = 200


class VoiceLog:
    def __init__(self, hass: HomeAssistant) -> None:
        self._store: Store[dict[str, Any]] = Store(hass, 1, f"{DOMAIN}.voice_log", private=True)
        self.items: list[dict[str, Any]] = []

    async def async_load(self) -> None:
        data = await self._store.async_load() or {}
        self.items = list(data.get("items") or [])[-MAX_ITEMS:]

    def add(self, text: str, why: str, say: str = "") -> None:
        """why: no (no entendió) · ia (lo resolvió la IA, el gratis no) · duda (preguntó de vuelta)."""
        text = (text or "").strip()
        if not text:
            return
        self.items.append({"text": text[:200], "why": why, "say": (say or "")[:200], "at": dt_util.utcnow().isoformat(timespec="seconds")})
        del self.items[:-MAX_ITEMS]
        self._store.async_delay_save(lambda: {"items": self.items}, 10)

    async def async_clear(self) -> None:
        self.items = []
        await self._store.async_save({"items": []})
