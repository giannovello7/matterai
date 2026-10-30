"""Configuración del dashboard de la casa (lo que la app muestra).

Antes vivía como YAML en un panel de HA; ahora la guarda la integración y se edita
desde el panel MatterAI con el editor visual. Al instalarla por primera vez, se trae
sola la configuración que ya hubiera en algún panel.
"""

from __future__ import annotations

import copy
import logging
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.storage import Store

from .const import SIGNAL_CONFIG, STORAGE_KEY, STORAGE_VERSION

_LOGGER = logging.getLogger(__name__)

CARD_TYPE = "custom:matterai-home-card"


def find_card(node: Any) -> dict[str, Any] | None:
    """Busca la tarjeta MatterAI en la configuración de un panel (también dentro de stacks)."""
    if isinstance(node, dict):
        if node.get("type") == CARD_TYPE:
            return node
        for value in node.values():
            found = find_card(value)
            if found is not None:
                return found
    elif isinstance(node, list):
        for value in node:
            found = find_card(value)
            if found is not None:
                return found
    return None


def clean(config: dict[str, Any]) -> dict[str, Any]:
    out = copy.deepcopy(config or {})
    out.pop("type", None)
    out.pop("base_url", None)  # lo pone la app
    out.pop("voice", None)  # lo calcula la integración (hay o no clave de IA)
    return out


class Dashboard:
    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self.config: dict[str, Any] = {}
        self.imported_from: str | None = None

    async def async_load(self) -> None:
        data = await self._store.async_load()
        if data is not None:
            self.config = data.get("config", {})
            self.imported_from = data.get("imported_from")
            return
        found = await self._async_import_from_lovelace()
        if found:
            self.imported_from, self.config = found
            _LOGGER.info("Configuración del dashboard traída del panel «%s»", self.imported_from)
        await self._async_write()

    async def _async_write(self) -> None:
        await self._store.async_save({"config": self.config, "imported_from": self.imported_from})

    async def async_save(self, config: dict[str, Any]) -> None:
        self.config = clean(config)
        await self._async_write()
        async_dispatcher_send(self.hass, SIGNAL_CONFIG, self.config)

    async def _async_import_from_lovelace(self) -> tuple[str, dict[str, Any]] | None:
        """Primero el panel que diga «matterai», después cualquiera que tenga la tarjeta."""
        lovelace = self.hass.data.get("lovelace")
        dashboards = getattr(lovelace, "dashboards", None)
        if dashboards is None and isinstance(lovelace, dict):
            dashboards = lovelace.get("dashboards")
        if not dashboards:
            return None
        order = sorted(dashboards.items(), key=lambda kv: (0 if kv[0] and "matterai" in kv[0] else 1 if kv[0] else 2))
        for url_path, dash in order:
            try:
                cfg = await dash.async_load(False)
            except Exception:  # noqa: BLE001 - panel vacío, en YAML o con errores: se sigue con el próximo
                continue
            card = find_card(cfg)
            if card is not None:
                return (url_path or "lovelace", clean(card))
        return None
