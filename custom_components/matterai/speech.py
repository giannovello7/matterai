"""Audio → texto con el motor de voz que ya tenga la casa (Whisper local, Google Cloud, HA Cloud…).

Se usa cuando el navegador no puede reconocer la voz por su cuenta (iPhone con Chrome, la app de HA en iOS…):
la app graba el audio, lo manda acá y se transcribe con el mismo motor que usa el asistente de HA.
"""

from __future__ import annotations

import logging
from typing import Any

from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)

SAMPLE_RATE = 16000
MAX_SECONDS = 15


def _pick_engine(hass: HomeAssistant) -> tuple[str | None, str | None]:
    """Motor y su idioma: el del asistente preferido de HA; si no tiene, el motor por defecto (en español)."""
    try:
        from homeassistant.components.assist_pipeline import async_get_pipeline  # noqa: PLC0415

        pipe = async_get_pipeline(hass)
        if pipe and pipe.stt_engine:
            return pipe.stt_engine, pipe.stt_language
    except Exception:  # noqa: BLE001 - sin asistente configurado: se busca un motor suelto
        pass
    try:
        from homeassistant.components import stt  # noqa: PLC0415

        return stt.async_default_engine(hass), None
    except Exception:  # noqa: BLE001
        return None, None


def _language(provider, preferred: str | None) -> str | None:
    langs = list(getattr(provider, "supported_languages", None) or [])
    if preferred and preferred in langs:
        return preferred
    for wanted in ("es-AR", "es-US", "es-419", "es-ES", "es", "es-MX"):
        if wanted in langs:
            return wanted
    return next((lang for lang in langs if str(lang).lower().startswith("es")), langs[0] if langs else preferred)


async def async_transcribe(hass: HomeAssistant, pcm16: bytes) -> dict[str, Any]:
    """PCM 16 bits, mono, 16 kHz → {"text"} o {"error"}."""
    if "stt" not in hass.config.components:
        return {"error": "no_stt"}
    from homeassistant.components import stt  # noqa: PLC0415

    engine_id, preferred = _pick_engine(hass)
    provider = stt.async_get_speech_to_text_engine(hass, engine_id) if engine_id else None
    if provider is None:
        return {"error": "no_stt"}
    language = _language(provider, preferred)
    meta = stt.SpeechMetadata(
        language=language or "es",
        format=stt.AudioFormats.WAV,
        codec=stt.AudioCodecs.PCM,
        bit_rate=stt.AudioBitRates.BITRATE_16,
        sample_rate=stt.AudioSampleRates.SAMPLERATE_16000,
        channel=stt.AudioChannels.CHANNEL_MONO,
    )
    pcm16 = pcm16[: SAMPLE_RATE * 2 * MAX_SECONDS]

    async def _chunks():
        for i in range(0, len(pcm16), 4096):
            yield pcm16[i : i + 4096]

    try:
        res = await provider.async_process_audio_stream(meta, _chunks())
    except Exception as err:  # noqa: BLE001 - motor caído (por ejemplo, el complemento Whisper apagado)
        _LOGGER.warning("Voz: el motor %s no pudo transcribir: %s", engine_id, err)
        return {"error": "stt_failed"}
    text = (getattr(res, "text", None) or "").strip()
    if getattr(res, "result", None) != stt.SpeechResultState.SUCCESS or not text:
        return {"error": "no_speech"}
    return {"text": text, "engine": engine_id}
