"""Música por voz como en una casa real: parlantes repetidos (Cast + Music Assistant), con otro nombre
("Altillo" es el del quincho), uno que no responde y reproductores web que no son parlantes."""

from __future__ import annotations

import pytest

from homeassistant.core import HomeAssistant, SupportsResponse
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import entity_registry as er
from homeassistant.setup import async_setup_component

from pytest_homeassistant_custom_component.common import MockConfigEntry, async_mock_service

from custom_components.matterai.const import DOMAIN
from custom_components.matterai.local_voice import interpret
from custom_components.matterai.voice import house_catalog, validate_actions

CONFIG = {"rooms": [
    {"name": "Quincho", "entities": ["light.quincho", "media_player.tv_quincho"]},
    {"name": "Dormitorio", "entities": ["light.dorm", "media_player.dormitorio_speaker"]},
    {"name": "Comedor", "entities": ["light.comedor"]},
    {"name": "Living", "entities": ["light.living"]},
    {"name": "Música", "entities": ["media_player.matteraudio"]},
]}


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    yield


def _house(hass: HomeAssistant, comedor="playing") -> None:
    reg, areas = er.async_get(hass), ar.async_get(hass)
    quincho = areas.async_create("Quincho")

    def player(obj, platform, state, name, area=None, **attrs):
        e = reg.async_get_or_create("media_player", platform, obj, suggested_object_id=obj)
        if area:
            reg.async_update_entity(e.entity_id, area_id=area)
        hass.states.async_set(e.entity_id, state, {"friendly_name": name, **attrs})

    player("matteraudio", "music_assistant", "idle", "Altillo", area=quincho.id, volume_level=0.3)
    player("zeroaltillo", "music_assistant", "idle", "zeroaltillo")
    player("dormitorio", "music_assistant", "idle", "Dormitorio", volume_level=0.5)
    player("dormitorio_2", "music_assistant", "unavailable", "Dormitorio")
    player("dormitorio_speaker", "cast", "off", "Dormitorio speaker")
    player("comedor", "music_assistant", comedor, "Comedor", volume_level=0.4, media_title="Persiana americana", media_artist="Soda Stereo")
    player("web_chrome_on_windows", "music_assistant", "idle", "Web (Chrome on Windows)")
    player("tv_tele_del_quincho", "music_assistant", "idle", "[TV] tele del quincho")
    player("tv_quincho", "samsungtv", "off", "TV Quincho", device_class="tv")
    for lid in ("light.quincho", "light.dorm", "light.comedor", "light.living"):
        hass.states.async_set(lid, "off", {"friendly_name": lid.split(".")[1].title()})


def _run(hass, text, memo=None):
    rooms = house_catalog(hass, CONFIG)
    res = interpret(hass, rooms, text, memo if memo is not None else {})
    if res is None:
        return None, None
    calls, skipped = validate_actions(hass, {e["id"] for r in rooms for e in r["equipos"]}, res["acciones"])
    assert not skipped, skipped
    return [(f"{d}.{s}", x) for d, s, x in calls], res["respuesta"]


async def test_speaker_per_room(hass: HomeAssistant) -> None:
    _house(hass)
    rooms = {r["ambiente"]: r.get("parlante") for r in house_catalog(hass, CONFIG)}
    assert rooms["Quincho"] == "media_player.matteraudio"  # el de Music Assistant en el área quincho, aunque se llame Altillo
    assert rooms["Dormitorio"] == "media_player.dormitorio"  # el gemelo del Cast, y no el repetido que no responde
    assert rooms["Comedor"] == "media_player.comedor"  # por nombre
    assert rooms["Living"] is None  # no hay: no inventa (ni la web ni la tele)


PLAY = [
    ("reproducí música en el quincho", "matterai.play_something", "media_player.matteraudio", {}),
    ("poné música en el dormitorio", "matterai.play_something", "media_player.dormitorio", {}),
    ("Poné Soda Stereo en el quincho", "music_assistant.play_media", "media_player.matteraudio", {"media_id": "soda stereo"}),
    ("poné la canción Persiana americana de Soda Stereo en el dormitorio", "music_assistant.play_media", "media_player.dormitorio",
     {"media_id": "persiana americana", "media_type": "track", "artist": "soda stereo"}),
    ("poné el disco Signos en el comedor", "music_assistant.play_media", "media_player.comedor", {"media_id": "signos", "media_type": "album"}),
    ("poné la playlist rock nacional en el quincho", "music_assistant.play_media", "media_player.matteraudio", {"media_id": "rock nacional", "media_type": "playlist"}),
    ("poné radio Mitre en el quincho", "music_assistant.play_media", "media_player.matteraudio", {"media_id": "mitre", "media_type": "radio"}),
    ("tocá algo de los Redondos", "music_assistant.play_media", "media_player.comedor", {"media_id": "los redondos", "radio_mode": True}),  # sin lugar: donde suena
    ("agregá Musica ligera a la cola", "music_assistant.play_media", "media_player.comedor", {"media_id": "musica ligera", "enqueue": "add"}),
    ("pausá la música", "media_player.media_pause", "media_player.comedor", {}),
    ("siguiente", "media_player.media_next_track", "media_player.comedor", {}),
    ("pasá de tema", "media_player.media_next_track", "media_player.comedor", {}),
    ("subí el volumen", "media_player.volume_set", "media_player.comedor", {"volume_level": 0.52}),
    ("volumen al 30 en el quincho", "media_player.volume_set", "media_player.matteraudio", {"volume_level": 0.3}),
    ("bajá un poco la música", "media_player.volume_set", "media_player.comedor", {"volume_level": 0.34}),
    ("pasá la música al dormitorio", "music_assistant.transfer_queue", "media_player.dormitorio", {"source_player": "media_player.comedor", "auto_play": True}),
    ("apagá la música", "media_player.media_pause", "media_player.comedor", {}),
    ("poné en aleatorio", "media_player.shuffle_set", "media_player.comedor", {"shuffle": True}),
]


@pytest.mark.parametrize(("text", "service", "target", "extra"), PLAY, ids=[p[0] for p in PLAY])
async def test_music_phrases(hass: HomeAssistant, text, service, target, extra) -> None:
    _house(hass)
    calls, say = _run(hass, text)
    assert calls, f"{text!r} no hizo nada ({say})"
    svc, data = calls[0]
    assert svc == service and data["entity_id"] == [target], (text, calls)
    for k, v in extra.items():
        assert data.get(k) == v, (text, k, data)
    assert say.startswith("Listo")


async def test_questions_and_limits(hass: HomeAssistant) -> None:
    _house(hass)
    _, say = _run(hass, "¿qué está sonando?")
    assert "Persiana americana" in say and "Soda Stereo" in say and "Comedor" in say
    calls, say = _run(hass, "poné música en el living")
    assert not calls and "Living" in say  # no tiene parlante: lo dice
    calls, _ = _run(hass, "prendé la luz del quincho")
    assert calls[0][0] == "light.turn_on"  # lo que no es música sigue igual


async def test_remembers_last_speaker_and_asks(hass: HomeAssistant) -> None:
    _house(hass, comedor="idle")
    memo: dict = {}
    calls, say = _run(hass, "poné música", memo)
    assert not calls and "ambiente" in say  # nada sonando y varios parlantes: pregunta dónde
    _run(hass, "poné música en el quincho", memo)
    calls, _ = _run(hass, "subí el volumen", memo)
    assert calls[0][1]["entity_id"] == ["media_player.matteraudio"]  # el último que usó
    hass.states.async_set("media_player.matteraudio", "paused", {"friendly_name": "Altillo", "media_title": "Tema"})
    calls, say = _run(hass, "poné música en el quincho", memo)
    assert calls[0][0] == "media_player.media_play" and "sigo" in say  # estaba en pausa: sigue


async def test_play_something_uses_music_assistant_library(hass: HomeAssistant, hass_ws_client) -> None:
    """ "Poné música" sin decir qué: una lista favorita al azar de Music Assistant."""
    _house(hass, comedor="idle")
    await async_setup_component(hass, "http", {})
    MockConfigEntry(domain="music_assistant", entry_id="ma1").add_to_hass(hass)
    lib = async_mock_service(hass, "music_assistant", "get_library", response={"items": [{"uri": "library://playlist/7", "name": "Asado"}]}, supports_response=SupportsResponse.ONLY)
    play = async_mock_service(hass, "music_assistant", "play_media")
    entry = MockConfigEntry(domain=DOMAIN, data={"name": "Casa", "url": "https://c.matterai.com.ar", "support_phone": "", "central_key": "", "central_url": "", "ai_key": "", "voice_mode": "local"})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    await hass.data[DOMAIN]["dashboard"].async_save(CONFIG)
    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": "matterai/voice", "text": "poné música en el quincho"})
    r = (await ws.receive_json())["result"]
    await hass.async_block_till_done()
    assert r["say"].startswith("Listo") and lib and lib[0].data["config_entry_id"] == "ma1"
    assert play and play[0].data["media_id"] == "library://playlist/7" and play[0].data["entity_id"] == ["media_player.matteraudio"]
