"""Comandos por WebSocket.

- La app de los clientes (usuario sin admin) sólo lee la configuración del dashboard.
- El panel MatterAI (sólo administradores: el instalador) edita, vincula celulares y ve el estado.
"""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.dispatcher import async_dispatcher_connect

from .const import CONF_LOCAL_URL, CONF_WIFI, CONF_CENTRAL_KEY, CONF_CENTRAL_URL, CONF_NAME, CONF_SUPPORT, CONF_URL, DOMAIN, SIGNAL_CONFIG, VERSION


def _rt(hass: HomeAssistant):
    rt = hass.data.get(DOMAIN)
    if rt is None or rt.get("entry") is None:
        raise HomeAssistantError("La integración MatterAI no está configurada")
    return rt


def _public(rt) -> dict[str, Any]:
    """Lo que necesita la app: la configuración de la tarjeta con la marca y el soporte de la casa."""
    entry = rt["entry"]
    cfg = dict(rt["dashboard"].config)
    cfg.setdefault("installer", "MatterAI")
    support = entry.options.get(CONF_SUPPORT, entry.data.get(CONF_SUPPORT))
    if support and not cfg.get("support_phone"):
        cfg["support_phone"] = support
    cfg["voice"] = bool(rt.get("voice"))  # la app muestra el micrófono sólo si hay "cerebro"
    return {"config": cfg, "name": entry.options.get(CONF_NAME, entry.data.get(CONF_NAME, "")), "version": VERSION}


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/config"})
@callback
def ws_config(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    try:
        connection.send_result(msg["id"], _public(_rt(hass)))
    except HomeAssistantError as err:
        connection.send_error(msg["id"], "not_setup", str(err))


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/config/subscribe"})
@callback
def ws_config_subscribe(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """La app queda escuchando: cuando el instalador guarda, se redibuja al momento."""
    try:
        rt = _rt(hass)
    except HomeAssistantError as err:
        connection.send_error(msg["id"], "not_setup", str(err))
        return

    @callback
    def _changed(_cfg=None) -> None:
        connection.send_message(websocket_api.event_message(msg["id"], _public(rt)))

    connection.subscriptions[msg["id"]] = async_dispatcher_connect(hass, SIGNAL_CONFIG, _changed)
    connection.send_result(msg["id"])
    _changed()


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/config/save", vol.Required("config"): dict})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_config_save(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    rt = _rt(hass)
    await rt["dashboard"].async_save(msg["config"])
    connection.send_result(msg["id"], {"ok": True})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/pairing", vol.Optional("regenerate", default=False): bool})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_pairing(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    rt = _rt(hass)
    entry, house = rt["entry"], rt["house"]
    url = entry.options.get(CONF_URL, entry.data.get(CONF_URL, ""))
    if not url:
        connection.send_error(msg["id"], "no_url", "Falta la dirección remota de la casa (Configurar → Dirección)")
        return
    if msg["regenerate"]:
        await house.async_regenerate()
    name = entry.options.get(CONF_NAME, entry.data.get(CONF_NAME, ""))
    support = entry.options.get(CONF_SUPPORT, entry.data.get(CONF_SUPPORT))
    local = entry.options.get(CONF_LOCAL_URL, entry.data.get(CONF_LOCAL_URL, ""))
    wifi = entry.options.get(CONF_WIFI, entry.data.get(CONF_WIFI, ""))
    connection.send_result(msg["id"], await house.async_pairing(url, name, support, local, wifi))


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/status"})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_status(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    from .cors import cors_status  # noqa: PLC0415
    from .health import collect  # noqa: PLC0415

    rt = _rt(hass)
    entry = rt["entry"]
    hb = rt.get("heartbeat")
    opts = {**entry.data, **entry.options}
    connection.send_result(
        msg["id"],
        {
            "version": VERSION,
            "house_id": rt["house"].house_id,
            "name": opts.get(CONF_NAME, ""),
            "url": opts.get(CONF_URL, ""),
            "support_phone": opts.get(CONF_SUPPORT, ""),
            "imported_from": rt["dashboard"].imported_from,
            "cors": await cors_status(hass),
            "central": {
                "configured": bool(opts.get(CONF_CENTRAL_KEY)),
                "url": opts.get(CONF_CENTRAL_URL, ""),
                "ok": hb.last_ok if hb else None,
                "error": hb.last_error if hb else None,
            },
            "escenas": bool(hass.data.get("matterai_escenas")),
            "voice": {"on": bool(rt.get("voice")), "mode": rt["voice"].mode if rt.get("voice") else "off", "ai": bool(rt.get("voice") and rt["voice"].uses_ai)},
            "health": collect(hass),
        },
    )


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/heartbeat"})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_heartbeat(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    hb = _rt(hass).get("heartbeat")
    connection.send_result(msg["id"], {"ok": await hb.async_send() if hb else None, "error": hb.last_error if hb else "Sin panel central"})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/voice", vol.Required("text"): vol.All(str, vol.Length(min=1, max=500))})
@websocket_api.async_response
async def ws_voice(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Pedido por voz (ya pasado a texto en el celular). Se ejecuta con los permisos de quien habla."""
    rt = _rt(hass)
    brain = rt.get("voice")
    if brain is None:
        connection.send_error(msg["id"], "no_voice", "El control por voz no está activado en esta casa")
        return
    result = await brain.async_handle(msg["text"], rt["dashboard"].config, connection.context(msg))
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/voice_audio", vol.Required("audio"): str})
@websocket_api.async_response
async def ws_voice_audio(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Audio grabado en el celular (PCM 16 bits, 16 kHz, mono, en base64) → texto con el motor de voz de HA → pedido."""
    import base64  # noqa: PLC0415

    from .speech import async_transcribe  # noqa: PLC0415

    rt = _rt(hass)
    brain = rt.get("voice")
    if brain is None:
        connection.send_error(msg["id"], "no_voice", "El control por voz no está activado en esta casa")
        return
    try:
        pcm = base64.b64decode(msg["audio"], validate=False)
    except ValueError:
        connection.send_error(msg["id"], "bad_audio", "Audio inválido")
        return
    heard = await async_transcribe(hass, pcm)
    if "error" in heard:
        say = {
            "no_stt": "Esta casa no tiene un motor de voz para entender audio. Avisale a tu instalador.",
            "stt_failed": "El motor de voz de la casa no respondió. Probá de nuevo en un ratito.",
        }.get(heard["error"], "No te escuché bien, probá de nuevo.")
        connection.send_result(msg["id"], {"ok": False, "say": say, "actions": [], "text": "", "error": heard["error"]})
        return
    result = await brain.async_handle(heard["text"], rt["dashboard"].config, connection.context(msg))
    connection.send_result(msg["id"], {**result, "text": heard["text"]})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/voice_log", vol.Optional("clear", default=False): bool})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_voice_log(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Frases que la voz gratis no entendió (las más nuevas primero), para mejorar las reglas."""
    brain = _rt(hass).get("voice")
    log = brain.log if brain is not None else None
    if log is None:
        connection.send_result(msg["id"], {"items": [], "on": False})
        return
    if msg["clear"]:
        await log.async_clear()
    connection.send_result(msg["id"], {"items": list(reversed(log.items)), "on": True})


COMMANDS = (ws_voice_log, ws_voice_audio, ws_voice, ws_config, ws_config_subscribe, ws_config_save, ws_pairing, ws_status, ws_heartbeat)
