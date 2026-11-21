"""Comandos WebSocket de Matte para la app.

- matterai/matte/chat {text, session_id?, origen?}: un mensaje (escrito o por voz) → respuesta + propuestas.
- matterai/matte/confirmar {session_id, propuesta_id, si, segura?}: los botones Sí / No de una propuesta.
- matterai/matte/memoria: lo que Matte sabe de quien pregunta (lo suyo y lo de la casa).
- matterai/matte/memoria_borrar {id} · memoria_corregir {id, texto} · memoria_borrar_todo: control total.
"""

from __future__ import annotations

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from ..const import DOMAIN


def asistente(hass: HomeAssistant):
    return (hass.data.get(DOMAIN) or {}).get("asistente")


def _sin(connection, msg) -> None:
    connection.send_error(msg["id"], "no_matte", "Matte no está activado en esta casa")


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/matte/chat",
    vol.Required("text"): vol.All(str, vol.Length(min=1, max=2000)),
    vol.Optional("session_id"): vol.Any(None, vol.All(str, vol.Length(max=64))),
    vol.Optional("origen", default="app"): vol.In(["app", "voz"]),
})
@websocket_api.async_response
async def ws_matte_chat(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    a = asistente(hass)
    if a is None:
        _sin(connection, msg)
        return
    connection.send_result(msg["id"], await a.conversar(connection.user, msg["text"], msg.get("session_id"), msg["origen"]))


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/matte/confirmar",
    vol.Required("session_id"): vol.All(str, vol.Length(max=64)),
    vol.Required("propuesta_id"): vol.All(str, vol.Length(max=16)),
    vol.Required("si"): bool,
    vol.Optional("segura", default=False): bool,
})
@websocket_api.async_response
async def ws_matte_confirmar(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    a = asistente(hass)
    if a is None:
        _sin(connection, msg)
        return
    connection.send_result(msg["id"], await a.confirmar(connection.user, msg["session_id"], msg["propuesta_id"], msg["si"], msg["segura"]))


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/matte/memoria"})
@callback
def ws_matte_memoria(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    a = asistente(hass)
    if a is None:
        connection.send_result(msg["id"], {"activo": False, "casa": [], "mia": []})
        return
    connection.send_result(msg["id"], {"activo": a.disponible, **a.memoria.de(connection.user.id), "rechazos": a.memoria.rechazos(connection.user.id)})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/matte/memoria_borrar", vol.Required("id"): vol.All(str, vol.Length(max=16))})
@callback
def ws_matte_memoria_borrar(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    a = asistente(hass)
    connection.send_result(msg["id"], {"ok": bool(a and a.memoria.borrar(connection.user.id, msg["id"]))})


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/matte/memoria_corregir",
    vol.Required("id"): vol.All(str, vol.Length(max=16)),
    vol.Required("texto"): vol.All(str, vol.Length(min=1, max=300)),
})
@callback
def ws_matte_memoria_corregir(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    a = asistente(hass)
    connection.send_result(msg["id"], {"ok": bool(a and a.memoria.corregir(connection.user.id, msg["id"], msg["texto"]))})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/matte/memoria_borrar_todo"})
@callback
def ws_matte_memoria_borrar_todo(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    a = asistente(hass)
    if a is not None:
        a.memoria.borrar_todo(connection.user.id)
    connection.send_result(msg["id"], {"ok": True})


WS_COMMANDS = (ws_matte_chat, ws_matte_confirmar, ws_matte_memoria, ws_matte_memoria_borrar, ws_matte_memoria_corregir, ws_matte_memoria_borrar_todo)
