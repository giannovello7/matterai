"""Alta de la casa: una sola pantalla.

Nombre del cliente, dirección remota (la de Cloudflare), WhatsApp de soporte y,
si el instalador usa el panel central, la clave de la casa. Si MatterAI Escenas está
instalada, la deja configurada también (automatizaciones y recordatorios de la app).
"""

from __future__ import annotations

import logging
import re
from typing import Any

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.helpers.selector import SelectSelector, SelectSelectorConfig, SelectSelectorMode

from .const import CONF_AI_KEY, CONF_LOCAL_URL, CONF_WIFI, CONF_VOICE_MODE, CONF_CENTRAL_KEY, CONF_CENTRAL_URL, CONF_NAME, CONF_SUPPORT, CONF_URL, DEFAULT_CENTRAL_URL, DOMAIN

_LOGGER = logging.getLogger(__name__)


def _clean_url(url: str) -> str:
    url = (url or "").strip().rstrip("/")
    if url and not re.match(r"^https?://", url, re.I):
        url = "https://" + url
    return url


def _local_url(hass) -> str:
    """La dirección de HA dentro de la red de la casa (la sugiere sola; el instalador la puede cambiar)."""
    try:
        from homeassistant.helpers.network import get_url  # noqa: PLC0415

        return get_url(hass, allow_external=False, allow_cloud=False, prefer_external=False)
    except Exception:  # noqa: BLE001 - sin dirección local conocida
        return ""


def _schema(d: dict[str, Any], extra: dict | None = None) -> vol.Schema:
    fields = {
        vol.Required(CONF_NAME, default=d.get(CONF_NAME, "")): str,
        vol.Required(CONF_URL, default=d.get(CONF_URL, "")): str,
        vol.Optional(CONF_LOCAL_URL, default=d.get(CONF_LOCAL_URL, "")): str,
        vol.Optional(CONF_WIFI, default=d.get(CONF_WIFI, "")): str,
        vol.Optional(CONF_SUPPORT, default=d.get(CONF_SUPPORT, "")): str,
        vol.Optional(CONF_CENTRAL_KEY, default=d.get(CONF_CENTRAL_KEY, "")): str,
        vol.Optional(CONF_CENTRAL_URL, default=d.get(CONF_CENTRAL_URL, DEFAULT_CENTRAL_URL)): str,
        vol.Optional(CONF_VOICE_MODE, default=d.get(CONF_VOICE_MODE, "auto")): SelectSelector(
            SelectSelectorConfig(options=["auto", "local", "ai", "off"], translation_key="voice_mode", mode=SelectSelectorMode.DROPDOWN)
        ),
        vol.Optional(CONF_AI_KEY, default=d.get(CONF_AI_KEY, "")): str,
    }
    fields.update(extra or {})
    return vol.Schema(fields)


def _validate(user_input: dict[str, Any]) -> tuple[dict[str, Any], dict[str, str]]:
    data = dict(user_input)
    errors: dict[str, str] = {}
    data[CONF_URL] = _clean_url(data.get(CONF_URL, ""))
    if not re.match(r"^https?://[^\s/]+", data[CONF_URL]):
        errors[CONF_URL] = "bad_url"
    data[CONF_LOCAL_URL] = (data.get(CONF_LOCAL_URL) or "").strip().rstrip("/")
    if data[CONF_LOCAL_URL] and not re.match(r"^https?://", data[CONF_LOCAL_URL], re.I):
        data[CONF_LOCAL_URL] = "http://" + data[CONF_LOCAL_URL]
    if data[CONF_LOCAL_URL] and not re.match(r"^https?://[^\s/]+(:\d+)?$", data[CONF_LOCAL_URL]):
        errors[CONF_LOCAL_URL] = "bad_local_url"
    data[CONF_WIFI] = ", ".join(w.strip() for w in (data.get(CONF_WIFI) or "").split(",") if w.strip())
    data[CONF_SUPPORT] = re.sub(r"\D", "", data.get(CONF_SUPPORT, ""))
    data[CONF_CENTRAL_URL] = _clean_url(data.get(CONF_CENTRAL_URL, "")) or DEFAULT_CENTRAL_URL
    data[CONF_CENTRAL_KEY] = (data.get(CONF_CENTRAL_KEY) or "").strip()
    data[CONF_AI_KEY] = (data.get(CONF_AI_KEY) or "").strip()
    if data[CONF_AI_KEY] and not data[CONF_AI_KEY].startswith("sk-ant-"):
        errors[CONF_AI_KEY] = "bad_ai_key"
    return data, errors


class MatterAIConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None):
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")
        extra: dict = {}
        errors: dict[str, str] = {}
        if user_input is not None:
            data, errors = _validate(user_input)
            if not errors:
                return self.async_create_entry(title=f"MatterAI · {data[CONF_NAME]}", data=data)
        defaults = {CONF_URL: self.hass.config.external_url or "", CONF_LOCAL_URL: _local_url(self.hass), **(user_input or {})}
        return self.async_show_form(step_id="user", data_schema=_schema(defaults, extra), errors=errors)

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        return MatterAIOptionsFlow()


class MatterAIOptionsFlow(config_entries.OptionsFlow):
    async def async_step_init(self, user_input: dict[str, Any] | None = None):
        errors: dict[str, str] = {}
        if user_input is not None:
            data, errors = _validate(user_input)
            if not errors:
                return self.async_create_entry(data=data)
        current = {**self.config_entry.data, **self.config_entry.options, **(user_input or {})}
        return self.async_show_form(step_id="init", data_schema=_schema(current), errors=errors)
