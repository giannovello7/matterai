"""Voz GRATIS (sin IA): frases como las diría un cliente → acciones correctas."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component

from pytest_homeassistant_custom_component.common import MockConfigEntry, async_mock_service

from custom_components.matterai.const import DOMAIN
from custom_components.matterai.local_voice import interpret
from custom_components.matterai.voice import house_catalog, validate_actions

CONFIG = {"rooms": [
    {"name": "Living", "entities": [{"entity": "light.living_techo", "name": "Luz living"}, {"entity": "light.living_tira", "name": "Tira LED"},
                                     "climate.aire_living", "media_player.tv_living", "cover.cortina_living"]},
    {"name": "Dormitorio", "entities": [{"entity": "light.dorm_principal", "name": "Luz principal"}, {"entity": "light.velador", "name": "Velador"},
                                         "climate.aire_dormitorio", {"entity": "switch.caloventor", "name": "Caloventor"}, "fan.ventilador_dorm"]},
    {"name": "Quincho", "entities": ["light.quincho", "media_player.parlante_quincho", "cover.persiana_quincho", {"entity": "switch.luz_galeria", "name": "Luz galería"}]},
    {"name": "Cocina", "entities": ["light.cocina", "light.barra"]},
]}


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    yield


def _states(hass: HomeAssistant) -> None:
    for eid, st, attrs in [
        ("light.living_techo", "on", {"friendly_name": "Living techo"}), ("light.living_tira", "off", {}),
        ("climate.aire_living", "cool", {"current_temperature": 25, "temperature": 23, "friendly_name": "Aire living"}),
        ("media_player.tv_living", "off", {"device_class": "tv", "friendly_name": "Tele living"}),
        ("cover.cortina_living", "open", {}), ("light.dorm_principal", "off", {}), ("light.velador", "on", {}),
        ("climate.aire_dormitorio", "off", {"current_temperature": 22, "friendly_name": "Aire dormitorio"}), ("switch.caloventor", "off", {}),
        ("fan.ventilador_dorm", "off", {}), ("light.quincho", "off", {}), ("media_player.parlante_quincho", "playing", {"volume_level": 0.4, "friendly_name": "Parlante quincho"}),
        ("cover.persiana_quincho", "closed", {}), ("switch.luz_galeria", "off", {"friendly_name": "Luz galería"}), ("light.cocina", "off", {}), ("light.barra", "off", {}),
        ("scene.cine", "unknown", {"friendly_name": "Cine"}),
    ]:
        hass.states.async_set(eid, st, attrs)


def _run(hass: HomeAssistant, text: str):
    rooms = house_catalog(hass, CONFIG)
    res = interpret(hass, rooms, text)
    if res is None:
        return None, None
    calls, _ = validate_actions(hass, {e["id"] for r in rooms for e in r["equipos"]}, res["acciones"])
    return sorted((f"{d}.{s}", tuple(sorted(x["entity_id"])), {k: v for k, v in x.items() if k != "entity_id"}) for d, s, x in calls), res["respuesta"]


CASES = [
    # luces
    ("Prendé la luz del living", [("light.turn_on", ("light.living_techo", "light.living_tira"), {})]),
    ("encendé las luces de la cocina", [("light.turn_on", ("light.barra", "light.cocina"), {})]),
    ("apagá la luz del dormitorio", [("light.turn_off", ("light.dorm_principal", "light.velador"), {})]),
    ("apaga el velador", [("light.turn_off", ("light.velador",), {})]),
    ("prendé la tira led", [("light.turn_on", ("light.living_tira",), {})]),
    ("la luz del living al 30%", [("light.turn_on", ("light.living_techo", "light.living_tira"), {"brightness_pct": 30})]),
    ("poné la luz principal al 50 por ciento", [("light.turn_on", ("light.dorm_principal",), {"brightness_pct": 50})]),
    ("prendé la luz de la galería", [("switch.turn_on", ("switch.luz_galeria",), {})]),  # switch con nombre de luz
    ("Prendé las luces del quincho y la cocina", [("light.turn_on", ("light.barra", "light.cocina", "light.quincho"), {}), ("switch.turn_on", ("switch.luz_galeria",), {})]),
    ("apagá todas las luces", [("light.turn_off", ("light.barra", "light.cocina", "light.dorm_principal", "light.living_techo", "light.living_tira", "light.quincho", "light.velador"), {}),
                               ("switch.turn_off", ("switch.luz_galeria",), {})]),
    # aire
    ("apagá el aire del living", [("climate.turn_off", ("climate.aire_living",), {})]),
    ("poné el aire del dormitorio en 23", [("climate.set_temperature", ("climate.aire_dormitorio",), {"temperature": 23.0})]),
    ("aire del living a 24 grados en frío", [("climate.set_temperature", ("climate.aire_living",), {"temperature": 24.0, "hvac_mode": "cool"})]),
    ("poné el aire del dormitorio en calor", [("climate.set_hvac_mode", ("climate.aire_dormitorio",), {"hvac_mode": "heat"})]),
    ("prendé el aire del dormitorio", [("climate.turn_on", ("climate.aire_dormitorio",), {})]),
    ("aire del living a veintidós grados", [("climate.set_temperature", ("climate.aire_living",), {"temperature": 22.0})]),
    # persianas
    ("bajá la persiana del quincho", [("cover.close_cover", ("cover.persiana_quincho",), {})]),
    ("subí la cortina del living", [("cover.open_cover", ("cover.cortina_living",), {})]),
    ("cortina del living a la mitad", [("cover.set_cover_position", ("cover.cortina_living",), {"position": 50})]),
    # ventilador, enchufes
    ("prendé el ventilador del dormitorio", [("fan.turn_on", ("fan.ventilador_dorm",), {})]),
    ("prendé el caloventor", [("switch.turn_on", ("switch.caloventor",), {})]),
    # música y tele
    ("pausá la música", [("media_player.media_pause", ("media_player.parlante_quincho",), {})]),
    ("subí el volumen", [("media_player.volume_set", ("media_player.parlante_quincho",), {"volume_level": 0.52})]),  # 0.4 + un paso
    ("volumen al 20 en el quincho", [("media_player.volume_set", ("media_player.parlante_quincho",), {"volume_level": 0.2})]),
    ("poné Soda Stereo en el quincho", [("music_assistant.play_media", ("media_player.parlante_quincho",), {"media_id": "soda stereo"})]),
    ("poné música de los redondos en el quincho", [("music_assistant.play_media", ("media_player.parlante_quincho",), {"media_id": "los redondos", "radio_mode": True})]),  # el artista y después parecidos
    ("siguiente canción", [("media_player.media_next_track", ("media_player.parlante_quincho",), {})]),
    ("apagá la tele del living", [("media_player.turn_off", ("media_player.tv_living",), {})]),
    # escenas y "todo"
    ("activá la escena cine", [("scene.turn_on", ("scene.cine",), {})]),
    ("modo cine", [("scene.turn_on", ("scene.cine",), {})]),
    ("apagá todo en el living", [("climate.turn_off", ("climate.aire_living",), {}), ("light.turn_off", ("light.living_techo", "light.living_tira"), {}), ("media_player.turn_off", ("media_player.tv_living",), {})]),
]


@pytest.mark.parametrize(("text", "expected"), CASES, ids=[c[0] for c in CASES])
async def test_phrases(hass: HomeAssistant, text, expected) -> None:
    _states(hass)
    calls, say = _run(hass, text)
    assert calls == sorted(expected), f"{text!r} → {calls}"
    assert say and say.startswith("Listo")


@pytest.mark.parametrize("text", ["prendé la luz", "hola, ¿cómo estás?", "contame un chiste", "abrí el portón", "desbloqueá la puerta"])
async def test_does_not_guess(hass: HomeAssistant, text) -> None:
    """Sin ambiente claro, o fuera de lo que sabe: no adivina (la IA, si hay, se encarga)."""
    _states(hass)
    calls, _ = _run(hass, text)
    assert not calls


async def test_questions(hass: HomeAssistant) -> None:
    _states(hass)
    rooms = house_catalog(hass, CONFIG)
    r = interpret(hass, rooms, "¿está prendida la luz del dormitorio?")
    assert r["acciones"] == [] and r["respuesta"].startswith("Sí") and "Velador" in r["respuesta"]
    r = interpret(hass, rooms, "¿quedó prendida la luz de la cocina?")
    assert r["respuesta"].startswith("No")
    r = interpret(hass, rooms, "¿qué temperatura hace en el living?")
    assert "25" in r["respuesta"]
    r = interpret(hass, rooms, "prendé el aire")  # varios aires y ningún ambiente: pregunta cuál
    assert r["acciones"] == [] and "ambiente" in r["respuesta"]


async def _setup(hass, mode, key="sk-ant-prueba"):
    await async_setup_component(hass, "http", {})
    entry = MockConfigEntry(domain=DOMAIN, data={"name": "Casa", "url": "https://c.matterai.com.ar", "support_phone": "", "central_key": "", "central_url": "", "ai_key": key, "voice_mode": mode})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    rt = hass.data[DOMAIN]
    await rt["dashboard"].async_save(CONFIG)
    return rt


async def test_auto_mode_free_first_then_ai(hass: HomeAssistant, hass_ws_client) -> None:
    """Modo mixto: lo común lo resuelve gratis (no se le pregunta a la IA); lo raro va a la IA."""
    _states(hass)
    rt = await _setup(hass, "auto")
    on = async_mock_service(hass, "light", "turn_on")
    ai = AsyncMock(return_value=SimpleNamespace(stop_reason="tool_use", content=[SimpleNamespace(type="tool_use", name="ejecutar", id="x", input={
        "acciones": [{"servicio": "light.turn_on", "entity_ids": ["light.quincho"], "brightness_pct": 20, "temperature": None, "hvac_mode": None, "position": None, "percentage": None, "volume_level": None, "media_query": None, "media_type": None}],
        "respuesta": "Listo, dejé el quincho con una luz tenue para el asado."})]))
    rt["voice"]._client = SimpleNamespace(messages=SimpleNamespace(create=ai))
    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": "matterai/voice", "text": "prendé la luz de la cocina"})
    r = (await ws.receive_json())["result"]
    assert r["source"] == "local" and ai.await_count == 0  # gratis
    await ws.send_json({"id": 2, "type": "matterai/voice", "text": "armame algo lindo en el quincho para el asado"})
    r = (await ws.receive_json())["result"]
    assert r["source"] == "ia" and ai.await_count == 1 and "asado" in r["say"]  # sólo lo raro paga
    await hass.async_block_till_done()
    assert len(on) == 2


async def test_local_mode_never_calls_ai(hass: HomeAssistant, hass_ws_client) -> None:
    _states(hass)
    rt = await _setup(hass, "local")
    ai = AsyncMock()
    rt["voice"]._client = SimpleNamespace(messages=SimpleNamespace(create=ai))
    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": "matterai/voice", "text": "armame algo lindo para el asado"})
    r = (await ws.receive_json())["result"]
    assert ai.await_count == 0 and r["actions"] == [] and "No te entendí" in r["say"]


async def test_status_shows_mode(hass: HomeAssistant, hass_ws_client) -> None:
    await _setup(hass, "auto", key="")
    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": "matterai/status"})
    v = (await ws.receive_json())["result"]["voice"]
    assert v == {"on": True, "mode": "auto", "ai": False}


async def test_misunderstood_phrases_are_logged(hass: HomeAssistant, hass_ws_client) -> None:
    """Lo que el modo gratis no entendió queda anotado para que el instalador mejore las reglas."""
    _states(hass)
    rt = await _setup(hass, "local")
    ws = await hass_ws_client(hass)
    for i, text in enumerate(["armame algo lindo para el asado", "prendé el aire", "prendé la luz de la cocina"], start=1):
        await ws.send_json({"id": i, "type": "matterai/voice", "text": text})
        await ws.receive_json()
    await ws.send_json({"id": 10, "type": "matterai/voice_log"})
    items = (await ws.receive_json())["result"]["items"]
    assert [(x["text"], x["why"]) for x in items] == [("prendé el aire", "duda"), ("armame algo lindo para el asado", "no")]  # lo entendido no se anota
    await ws.send_json({"id": 11, "type": "matterai/voice_log", "clear": True})
    assert (await ws.receive_json())["result"]["items"] == []
    assert rt["voice"].log.items == []
