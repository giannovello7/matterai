"""Audio grabado en el celular → motor de voz de HA → pedido (para iPhone, donde el navegador no reconoce la voz)."""

from __future__ import annotations

import base64
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from homeassistant.components import stt
from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component

from pytest_homeassistant_custom_component.common import MockConfigEntry, async_mock_service

from custom_components.matterai import speech
from custom_components.matterai.const import DOMAIN

CONFIG = {"rooms": [{"name": "Living", "entities": [{"entity": "light.living_tira", "name": "Tira LED"}]}]}


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    yield


class FakeEngine:
    supported_languages = ["en-US", "es-ES", "es-US"]

    def __init__(self, text="prendé la tira led", fail=False):
        self.text, self.fail, self.meta, self.got = text, fail, None, b""

    async def async_process_audio_stream(self, metadata, stream):
        self.meta = metadata
        async for chunk in stream:
            self.got += chunk
        if self.fail:
            raise ConnectionError("whisper apagado")
        state = stt.SpeechResultState.SUCCESS if self.text else stt.SpeechResultState.ERROR
        return SimpleNamespace(text=self.text, result=state)


async def test_transcribe_uses_house_engine(hass: HomeAssistant) -> None:
    hass.config.components.add("stt")
    eng = FakeEngine()
    pcm = b"\x01\x00" * 16000
    with patch.object(speech, "_pick_engine", return_value=("stt.google_cloud", "es-US")), \
         patch("homeassistant.components.stt.async_get_speech_to_text_engine", return_value=eng):
        r = await speech.async_transcribe(hass, pcm)
    assert r == {"text": "prendé la tira led", "engine": "stt.google_cloud"}
    assert eng.got == pcm and eng.meta.language == "es-US" and eng.meta.sample_rate == stt.AudioSampleRates.SAMPLERATE_16000


async def test_transcribe_errors(hass: HomeAssistant) -> None:
    assert (await speech.async_transcribe(hass, b"x"))["error"] == "no_stt"  # la casa no tiene motor de voz
    hass.config.components.add("stt")
    for eng, err in ((FakeEngine(fail=True), "stt_failed"), (FakeEngine(text=""), "no_speech")):
        with patch.object(speech, "_pick_engine", return_value=("stt.x", None)), \
             patch("homeassistant.components.stt.async_get_speech_to_text_engine", return_value=eng):
            assert (await speech.async_transcribe(hass, b"\x00\x00" * 100))["error"] == err
    assert speech._language(FakeEngine(), None) == "es-US"  # elige español aunque el asistente no diga


async def test_voice_audio_command(hass: HomeAssistant, hass_ws_client, hass_read_only_access_token) -> None:
    await async_setup_component(hass, "http", {})
    entry = MockConfigEntry(domain=DOMAIN, data={"name": "Casa", "url": "https://c.matterai.com.ar", "support_phone": "", "central_key": "", "central_url": "", "ai_key": "", "voice_mode": "local"})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    await hass.data[DOMAIN]["dashboard"].async_save(CONFIG)
    hass.states.async_set("light.living_tira", "off")
    on = async_mock_service(hass, "light", "turn_on")
    audio = base64.b64encode(b"\x00\x01" * 8000).decode()
    ws = await hass_ws_client(hass, hass_read_only_access_token)  # el usuario de la app, sin admin
    with patch("custom_components.matterai.speech.async_transcribe", return_value={"text": "prendé la tira led"}):
        await ws.send_json({"id": 1, "type": "matterai/voice_audio", "audio": audio})
        r = (await ws.receive_json())["result"]
    assert r["text"] == "prendé la tira led" and r["say"].startswith("Listo")
    await hass.async_block_till_done()
    assert on and on[0].data["entity_id"] == ["light.living_tira"]
    with patch("custom_components.matterai.speech.async_transcribe", return_value={"error": "no_stt"}):
        await ws.send_json({"id": 2, "type": "matterai/voice_audio", "audio": audio})
        r = (await ws.receive_json())["result"]
    assert r["ok"] is False and r["error"] == "no_stt" and "instalador" in r["say"]
