"""La página del dispositivo «Sistema MatterAI» tiene el acceso al panel MatterAI (2.34.2)."""
from __future__ import annotations

import pytest

from homeassistant.helpers import device_registry as dr
from homeassistant.setup import async_setup_component

from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.matterai.const import DOMAIN

DATA = {"name": "Casa Pérez", "url": "https://perez.matterai.com.ar", "support_phone": "5491100000000", "central_key": "", "central_url": "https://panel.matterai.com.ar"}


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    yield


async def test_dispositivo_con_acceso_al_panel(hass) -> None:
    await async_setup_component(hass, "http", {})
    entry = MockConfigEntry(domain=DOMAIN, data=DATA, title="MatterAI · Casa Pérez")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    dev = dr.async_get(hass).async_get_device(identifiers={(DOMAIN, f"{entry.entry_id}_system")})
    assert dev is not None
    assert dev.configuration_url == "homeassistant://matterai?tab=health"
