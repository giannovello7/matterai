"""Comandos WebSocket del alta (el asistente en pantallas de la app usa los mismos que Matte).

- matterai/alta/tool {herramienta, args}: corre una herramienta. Si abre la unión, se cierra sola si se corta la conexión.
- matterai/alta/subscribe: estado en vivo (cuenta regresiva, «Esperando dispositivo…», «Configurando…»).
- matterai/alta/permiso: si este usuario ve «Agregar dispositivo».
"""

from __future__ import annotations

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from ..const import DOMAIN
from .core import AltaError, puede_agregar
from .herramientas import SIN_PERMISO, alta, ejecutar


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/alta/permiso"})
@callback
def ws_alta_permiso(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    a = alta(hass)
    connection.send_result(msg["id"], {"permitido": a is not None and puede_agregar(hass, connection.user)})


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/alta/tool",
    vol.Required("herramienta"): vol.All(str, vol.Length(max=40)),  # se valida en ejecutar
    vol.Optional("args", default={}): dict,
})
@websocket_api.async_response
async def ws_alta_tool(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    out = await ejecutar(hass, connection.user, msg["herramienta"], msg["args"])
    if out.get("codigo") == "sin_permiso":
        connection.send_error(msg["id"], "unauthorized", SIN_PERMISO)
        return
    if msg["herramienta"] == "habilitar_union" and out.get("ok"):
        a = alta(hass)

        @callback
        def _cortada() -> None:
            # la app se cerró o perdió la conexión con la unión abierta: se cierra (siempre con vencimiento igual)
            if a is not None and a.union:
                hass.async_create_background_task(a.deshabilitar_union("sistema", "se cortó la sesión"), "matterai_alta_close")

        connection.subscriptions[msg["id"]] = _cortada
    connection.send_result(msg["id"], out)


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/alta/subscribe"})
@callback
def ws_alta_subscribe(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    a = alta(hass)
    if a is None or not puede_agregar(hass, connection.user):
        connection.send_error(msg["id"], "unauthorized", SIN_PERMISO)
        return

    @callback
    def _fwd(snap: dict) -> None:
        connection.send_message(websocket_api.event_message(msg["id"], snap))

    connection.subscriptions[msg["id"]] = a.subscribe(_fwd)
    connection.send_result(msg["id"])
    _fwd(a.snapshot())


def conversaciones(hass: HomeAssistant):
    from .matte import Conversaciones  # noqa: PLC0415

    rt = hass.data.setdefault(DOMAIN, {})
    if rt.get("matte") is None:
        rt["matte"] = Conversaciones(hass)
    return rt["matte"]


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/alta/matte",
    vol.Optional("session_id"): vol.Any(None, vol.All(str, vol.Length(max=40))),
    vol.Optional("texto", default=""): vol.All(str, vol.Length(max=800)),
    vol.Optional("audio"): str,
    vol.Optional("auto"): vol.In(["esperar", "descubierto"]),
})
@websocket_api.async_response
async def ws_alta_matte(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Un turno de la conversación con Matte (texto, o audio que se pasa a texto con el motor de voz de la casa)."""
    if not puede_agregar(hass, connection.user):
        connection.send_error(msg["id"], "unauthorized", SIN_PERMISO)
        return
    texto, oido = msg["texto"], None
    if msg.get("audio"):
        import base64  # noqa: PLC0415

        from ..speech import async_transcribe  # noqa: PLC0415

        try:
            pcm = base64.b64decode(msg["audio"], validate=False)
        except ValueError:
            connection.send_error(msg["id"], "bad_audio", "Audio inválido")
            return
        heard = await async_transcribe(hass, pcm)
        if "error" in heard:
            connection.send_result(msg["id"], {"ok": False, "say": "No te escuché bien, probá de nuevo o escribime.", "session_id": msg.get("session_id")})
            return
        texto = oido = heard["text"]
    if not texto.strip() and not msg.get("auto"):
        connection.send_error(msg["id"], "empty", "Escribí algo")
        return
    out = await conversaciones(hass).conversar(connection.user, msg.get("session_id"), texto, msg.get("auto"))
    if oido is not None:
        out["texto"] = oido
    connection.send_result(msg["id"], out)


# ---------------------------------------------------------------- campanita: lo que la casa encontró sola
@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/alta/descubrimientos", vol.Optional("device_id", default=""): str})
@callback
def ws_alta_descubrimientos(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """La lista en vivo (sólo el titular y el instalador). Cada cambio llega como evento: {items, push}."""
    desc = (hass.data.get(DOMAIN) or {}).get("descubrimientos")
    if desc is None or not puede_agregar(hass, connection.user):
        connection.send_error(msg["id"], "unauthorized", SIN_PERMISO)
        return
    dev = msg["device_id"][:64]

    @callback
    def _fwd(items: list) -> None:
        connection.send_message(websocket_api.event_message(msg["id"], {"items": items, "push": bool(desc.push.get(dev))}))

    connection.subscriptions[msg["id"]] = desc.subscribe(_fwd)
    connection.send_result(msg["id"])
    _fwd(desc.listar())


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/alta/descubrimientos_push",
    vol.Required("device_id"): vol.All(str, vol.Length(min=1, max=64)),
    vol.Required("on"): bool,
})
@callback
def ws_alta_descubrimientos_push(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Avisos al celular cuando la casa encuentra equipos nuevos (lo elige cada equipo; apagado de fábrica)."""
    desc = (hass.data.get(DOMAIN) or {}).get("descubrimientos")
    if desc is None or not puede_agregar(hass, connection.user):
        connection.send_error(msg["id"], "unauthorized", SIN_PERMISO)
        return
    desc.set_push(msg["device_id"], msg["on"])
    connection.send_result(msg["id"], {"on": msg["on"]})


# ---------------------------------------------------------------- Matter nuevo desde el celular (Android)
@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/alta/matter_red",
    vol.Required("pin"): vol.All(int, vol.Range(min=1, max=99999998)),
    vol.Optional("ip"): vol.All(str, vol.Length(max=64)),
})
@websocket_api.async_response
async def ws_alta_matter_red(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """El celular ya puso el equipo en la red (Google Play Services, escaneando el QR) y abrió la ventana de
    vinculación: la casa lo suma con ese PIN temporal. El PIN no se guarda ni va a los logs."""
    from .core import quien  # noqa: PLC0415
    from .matter import comisionar_en_red  # noqa: PLC0415

    a = alta(hass)
    if a is None or not puede_agregar(hass, connection.user):
        connection.send_error(msg["id"], "unauthorized", SIN_PERMISO)
        return
    if not a.desde:
        a.iniciar()
    try:
        out = await comisionar_en_red(hass, msg["pin"], msg.get("ip"))
    except AltaError as err:
        connection.send_result(msg["id"], {"ok": False, "error": str(err)})
        return
    a._audit("equipo Matter sumado desde el celular", "", await quien(hass, connection.user), "QR escaneado con la app")  # noqa: SLF001
    connection.send_result(msg["id"], {"ok": True, **out})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/alta/thread_red"})
@websocket_api.async_response
async def ws_alta_thread_red(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Los datos de la red Thread preferida de la casa, para que el celular pueda sumar equipos Thread nuevos
    (los guarda en Google Play Services, como la app de HA). Sólo el titular y el instalador; queda en la auditoría."""
    from .core import quien  # noqa: PLC0415
    from .matter import thread_red  # noqa: PLC0415

    a = alta(hass)
    if a is None or not puede_agregar(hass, connection.user):
        connection.send_error(msg["id"], "unauthorized", SIN_PERMISO)
        return
    try:
        out = await thread_red(hass)
    except AltaError as err:
        connection.send_result(msg["id"], {"ok": False, "error": str(err)})
        return
    a._audit("red Thread compartida con un celular", out.get("red") or "", await quien(hass, connection.user))  # noqa: SLF001
    connection.send_result(msg["id"], {"ok": True, **out})


WS_COMMANDS = (ws_alta_permiso, ws_alta_tool, ws_alta_subscribe, ws_alta_matte, ws_alta_descubrimientos,
               ws_alta_descubrimientos_push, ws_alta_matter_red, ws_alta_thread_red)
