"""Control por voz: la IA se simula; se prueba que la integración arme el pedido, valide y ejecute bien."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component

from pytest_homeassistant_custom_component.common import MockConfigEntry, async_mock_service

from custom_components.matterai.const import DOMAIN
from custom_components.matterai.voice import TOOL, house_catalog, validate_actions

DATA = {"name": "Casa", "url": "https://casa.matterai.com.ar", "support_phone": "", "central_key": "", "central_url": "https://panel.matterai.com.ar", "ai_key": "sk-ant-prueba", "voice_mode": "ai"}
CONFIG = {"rooms": [
    {"name": "Living", "entities": [{"entity": "light.living", "name": "Luz living"}, "media_player.parlante_living", "climate.aire_living"]},
    {"name": "Quincho", "entities": ["light.quincho", "cover.persiana_quincho", "cover.porton", "lock.puerta"]},
]}


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    yield


def _states(hass: HomeAssistant) -> None:
    hass.states.async_set("light.living", "off", {"friendly_name": "Living techo"})
    hass.states.async_set("light.quincho", "on", {"friendly_name": "Quincho", "brightness": 255})
    hass.states.async_set("media_player.parlante_living", "idle", {"friendly_name": "Parlante living"})
    hass.states.async_set("climate.aire_living", "off", {"friendly_name": "Aire", "current_temperature": 27, "temperature": 24})
    hass.states.async_set("cover.persiana_quincho", "open", {"friendly_name": "Persiana"})
    hass.states.async_set("cover.porton", "closed", {"friendly_name": "Portón", "device_class": "garage"})
    hass.states.async_set("lock.puerta", "locked", {"friendly_name": "Puerta"})


def test_tool_schema_is_strict() -> None:
    sch = TOOL["input_schema"]
    item = sch["properties"]["acciones"]["items"]
    assert TOOL["strict"] is True and sch["additionalProperties"] is False and item["additionalProperties"] is False
    assert set(item["required"]) == set(item["properties"])  # en modo estricto todo campo va en required


async def test_catalog_excludes_security(hass: HomeAssistant) -> None:
    _states(hass)
    rooms = house_catalog(hass, CONFIG)
    ids = {e["id"] for r in rooms for e in r["equipos"]}
    assert {"light.living", "media_player.parlante_living", "climate.aire_living", "light.quincho", "cover.persiana_quincho"} <= ids
    assert "cover.porton" not in ids and "lock.puerta" not in ids  # portones y cerraduras nunca por voz
    living = next(r for r in rooms if r["ambiente"] == "Living")
    assert {"id": "light.living", "nombre": "Luz living"} in living["equipos"]  # usa el nombre que ve el cliente


async def test_validate_actions(hass: HomeAssistant) -> None:
    _states(hass)
    allowed = {e["id"] for r in house_catalog(hass, CONFIG) for e in r["equipos"]}
    base = {"brightness_pct": None, "temperature": None, "hvac_mode": None, "position": None, "percentage": None, "volume_level": None, "media_query": None, "media_type": None}
    calls, skipped = validate_actions(hass, allowed, [
        {**base, "servicio": "light.turn_on", "entity_ids": ["light.living"], "brightness_pct": 150},
        {**base, "servicio": "climate.set_temperature", "entity_ids": ["climate.aire_living"], "temperature": 22, "hvac_mode": "cool"},
        {**base, "servicio": "cover.set_cover_position", "entity_ids": ["cover.persiana_quincho"], "position": 30},
        {**base, "servicio": "media_player.volume_set", "entity_ids": ["media_player.parlante_living"], "volume_level": 40},
        {**base, "servicio": "music_assistant.play_media", "entity_ids": ["media_player.parlante_living"], "media_query": "Soda Stereo", "media_type": "artist"},
        {**base, "servicio": "lock.unlock", "entity_ids": ["lock.puerta"]},  # prohibido
        {**base, "servicio": "cover.open_cover", "entity_ids": ["cover.porton"]},  # portón: no está en el catálogo
        {**base, "servicio": "light.turn_on", "entity_ids": ["light.inventada"]},  # no existe
        {**base, "servicio": "homeassistant.restart", "entity_ids": []},  # nada raro
    ])
    got = {f"{d}.{s}": data for d, s, data in calls}
    assert got["light.turn_on"] == {"entity_id": ["light.living"], "brightness_pct": 100}
    assert got["climate.set_temperature"] == {"entity_id": ["climate.aire_living"], "temperature": 22.0, "hvac_mode": "cool"}
    assert got["cover.set_cover_position"]["position"] == 30
    assert got["media_player.volume_set"]["volume_level"] == 0.4  # 40 → 0.4
    assert got["music_assistant.play_media"] == {"entity_id": ["media_player.parlante_living"], "media_id": "Soda Stereo", "media_type": "artist"}
    assert len(calls) == 5 and len(skipped) == 4


def _fake_response(acciones, respuesta, stop="tool_use"):
    block = SimpleNamespace(type="tool_use", name="ejecutar", input={"acciones": acciones, "respuesta": respuesta}, id="t1")
    return SimpleNamespace(stop_reason=stop, content=[block])


async def _setup(hass: HomeAssistant):
    await async_setup_component(hass, "http", {})
    entry = MockConfigEntry(domain=DOMAIN, data=DATA)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    rt = hass.data[DOMAIN]
    await rt["dashboard"].async_save(CONFIG)
    return rt


async def test_voice_end_to_end(hass: HomeAssistant, hass_ws_client, hass_read_only_access_token) -> None:
    _states(hass)
    rt = await _setup(hass)
    on = async_mock_service(hass, "light", "turn_on")
    fake = SimpleNamespace(messages=SimpleNamespace(create=AsyncMock(return_value=_fake_response(
        [{"servicio": "light.turn_on", "entity_ids": ["light.living"], "brightness_pct": None, "temperature": None, "hvac_mode": None, "position": None, "percentage": None, "volume_level": None, "media_query": None, "media_type": None}],
        "Listo, prendí la luz del living."))))
    rt["voice"]._client = fake

    # el usuario de la app (sin admin) puede usar la voz
    ws = await hass_ws_client(hass, hass_read_only_access_token)
    await ws.send_json({"id": 1, "type": "matterai/config"})
    assert (await ws.receive_json())["result"]["config"]["voice"] is True  # la app muestra el micrófono
    await ws.send_json({"id": 2, "type": "matterai/voice", "text": "prendé la luz del living"})
    res = await ws.receive_json()
    assert res["success"], res
    assert res["result"]["say"] == "Listo, prendí la luz del living." and res["result"]["actions"][0]["ok"]
    await hass.async_block_till_done()
    assert len(on) == 1 and on[0].data["entity_id"] == ["light.living"]
    assert on[0].context.user_id is not None  # se ejecuta como el usuario que habló

    # lo que se le mandó a la IA: catálogo en caché, estados aparte, herramienta estricta, modelo y fallbacks
    kw = fake.messages.create.call_args.kwargs
    assert kw["model"] == "claude-opus-5-5" and kw["tools"][0]["strict"] is True
    assert kw["system"][-1]["cache_control"] == {"type": "ephemeral"} and "light.living" in kw["system"][-1]["text"]
    assert "Estados ahora:" in kw["messages"][0]["content"] and "prendé la luz del living" in kw["messages"][0]["content"]
    assert "Estados" not in kw["system"][-1]["text"]  # lo que cambia no rompe la caché
    assert kw["extra_body"]["fallbacks"] == "default" and kw["extra_body"]["output_config"]["effort"] == "low"

    # guardar la config no guarda el indicador de voz
    await rt["dashboard"].async_save({**CONFIG, "voice": True})
    assert "voice" not in rt["dashboard"].config


async def test_voice_refusal_and_question(hass: HomeAssistant, hass_ws_client) -> None:
    _states(hass)
    rt = await _setup(hass)
    fake = SimpleNamespace(messages=SimpleNamespace(create=AsyncMock(return_value=_fake_response([], "", stop="refusal"))))
    rt["voice"]._client = fake
    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": "matterai/voice", "text": "abrí la puerta"})
    assert (await ws.receive_json())["result"]["actions"] == []
    fake.messages.create = AsyncMock(return_value=_fake_response([], "Sí, la luz del quincho está prendida."))
    await ws.send_json({"id": 2, "type": "matterai/voice", "text": "¿está prendida la luz del quincho?"})
    r = (await ws.receive_json())["result"]
    assert r["say"].startswith("Sí") and r["actions"] == []


async def test_free_voice_without_key(hass: HomeAssistant, hass_ws_client) -> None:
    await async_setup_component(hass, "http", {})
    entry = MockConfigEntry(domain=DOMAIN, data={**DATA, "ai_key": ""})
    entry.add_to_hass(hass)
    await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": "matterai/config"})
    assert (await ws.receive_json())["result"]["config"]["voice"] is True  # gratis: hay micrófono igual
    await ws.send_json({"id": 2, "type": "matterai/voice", "text": "hola"})
    r = (await ws.receive_json())["result"]
    assert r["source"] == "local" and r["actions"] == [] and "No te entendí" in r["say"]
