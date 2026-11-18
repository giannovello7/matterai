"""El instalador elige qué opciones de las automatizaciones usa el cliente (2.34): el servidor lo hace cumplir."""
from __future__ import annotations

from types import SimpleNamespace

import pytest

from homeassistant.setup import async_setup_component

from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.matterai.const import DOMAIN
from custom_components.matterai.escenas.const import DOMAIN as ESC
from custom_components.matterai.escenas.manager import InvalidRule, _rule_opts

DATA = {"name": "Casa Pérez", "url": "https://perez.matterai.com.ar", "support_phone": "5491100000000", "central_key": "", "central_url": "https://panel.matterai.com.ar"}
CLIENT = SimpleNamespace(is_admin=False, name="Cliente")


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    yield


async def _manager(hass):
    await async_setup_component(hass, "http", {})
    hass.states.async_set("light.living", "off", {"friendly_name": "Living"})
    entry = MockConfigEntry(domain=DOMAIN, data=DATA, title="MatterAI · Casa Pérez")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return hass.data[ESC]


def _auto(trigger: str, rid: str = "r1") -> dict:
    return {"id": rid, "kind": "auto", "name": "Prueba", "enabled": True, "mode": "single",
            "ui": {"triggers": [{"type": trigger}], "conditions": [], "actions": [{"type": "device"}]},
            "triggers": [{"trigger": "time", "at": "07:00:00"} if trigger == "time" else {"trigger": "sun", "event": "sunset"}],
            "conditions": [], "actions": [{"action": "light.turn_on", "target": {"entity_id": "light.living"}}]}


def test_rule_opts() -> None:
    assert _rule_opts(_auto("time")) == {"t:time", "a:device"}
    assert _rule_opts(None) == set()


async def test_opciones_apagadas_no_se_pueden_usar(hass) -> None:
    m = await _manager(hass)
    m.set_settings({"opt_off": ["t:sun", "ideas", 7]})
    assert m.settings["opt_off"] == ["ideas", "t:sun"]  # lo que no es texto no se guarda
    with pytest.raises(InvalidRule, match="no habilitó esa opción"):
        await m.async_save(_auto("sun"), CLIENT)
    saved = await m.async_save(_auto("time"), CLIENT)  # una opción habilitada, sí
    assert saved["kind"] == "auto"
    # el instalador (admin) puede usar todo
    await m.async_save(_auto("sun", "r2"), SimpleNamespace(is_admin=True, name="Instalador"))
    # y el cliente puede seguir cambiando una regla que ya la tenía (no suma nada nuevo)
    r2 = _auto("sun", "r2")
    r2["name"] = "Otro nombre"
    await m.async_save(r2, CLIENT)


async def test_tipos_apagados(hass) -> None:
    m = await _manager(hass)
    m.set_settings({"client_off": ["auto", "no_existe"]})
    assert m.settings["client_off"] == ["auto"]
    with pytest.raises(InvalidRule, match="no habilitó este tipo"):
        await m.async_save(_auto("time"), CLIENT)


async def test_pestanas_y_equipos(hass) -> None:
    m = await _manager(hass)
    m.set_settings({"tabs_off": ["smart", "nada"], "ents_mode": "pick", "shown": ["light.living", 3]})
    assert m.settings["tabs_off"] == ["smart"]
    assert m.settings["ents_mode"] == "pick" and m.settings["shown"] == ["light.living"]
    m.set_settings({"ents_mode": "cualquiera"})  # un modo que no existe no se guarda
    assert m.settings["ents_mode"] == "pick"
