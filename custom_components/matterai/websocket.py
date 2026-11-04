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
    """QR / link para vincular un celular: cada vez un código nuevo de un solo uso («regenerate» queda por compatibilidad)."""
    from .pairing import async_pairing_link  # noqa: PLC0415

    try:
        connection.send_result(msg["id"], await async_pairing_link(hass))
    except ValueError as err:
        connection.send_error(msg["id"], "no_url", str(err))


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/status"})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_status(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    from .cors import cors_status  # noqa: PLC0415
    from .health import async_collect  # noqa: PLC0415

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
                "latest": hb.latest if hb else None,
                "last_backup": hb.central.last_backup if hb else None,
                "backup_error": hb.central.last_error if hb else None,
            },
            "escenas": bool(hass.data.get("matterai_escenas")),
            "voice": {"on": bool(rt.get("voice")), "mode": rt["voice"].mode if rt.get("voice") else "off", "ai": bool(rt.get("voice") and rt["voice"].uses_ai)},
            "health": await async_collect(hass),
            "escenas_conflict": bool(rt.get("escenas_conflict")),
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


# ------------------------------------------------------------------ copias y plantillas (instalador)


def _central(hass: HomeAssistant):
    hb = _rt(hass).get("heartbeat")
    if hb is None:
        raise HomeAssistantError("Para esto hace falta el panel central: cargá la clave de la casa en Ficha de la casa → Cambiar datos")
    return hb.central


async def _guard(connection, msg: dict, factory) -> None:
    from .backup import BackupError  # noqa: PLC0415

    try:
        connection.send_result(msg["id"], await factory())
    except (BackupError, HomeAssistantError) as err:
        connection.send_error(msg["id"], "matterai_error", str(err))


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/backup/export"})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_backup_export(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Copia completa para bajar a un archivo."""
    from .backup import collect  # noqa: PLC0415

    async def run():
        data, summary = collect(hass)
        return {"data": data, "summary": summary}

    await _guard(connection, msg, run)


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/backup/restore", vol.Optional("data"): dict, vol.Optional("undo"): bool})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_backup_restore(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Restaura una copia (de un archivo) o deshace la última restauración."""
    from .backup import BackupError, async_apply, async_undo  # noqa: PLC0415

    async def run():
        if msg.get("undo"):
            return await async_undo(hass)
        if "data" not in msg:
            raise BackupError("Falta la copia")
        return await async_apply(hass, msg["data"])

    await _guard(connection, msg, run)


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/backup/send"})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_backup_send(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    async def run():
        central = _central(hass)
        await central.async_backup("pedida desde la casa", force=True)
        return {"ok": True, "at": central.last_backup}

    await _guard(connection, msg, run)


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/templates/list", vol.Optional("kind"): vol.In(["automations", "dashboard"])})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_templates_list(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    async def run():
        return {"templates": await _central(hass).async_templates(msg.get("kind"))}

    await _guard(connection, msg, run)


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/templates/save",
        vol.Required("kind"): vol.In(["automations", "dashboard"]),
        vol.Required("name"): vol.All(str, vol.Length(min=1, max=80)),
        vol.Optional("description", default=""): vol.All(str, vol.Length(max=500)),
        vol.Optional("rule_ids", default=[]): [str],
        vol.Optional("to_file", default=False): bool,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_templates_save(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Guarda una plantilla en el panel central (o la devuelve para bajarla a un archivo)."""
    from .backup import template_automations, template_dashboard  # noqa: PLC0415

    async def run():
        if msg["kind"] == "automations":
            data, summary = template_automations(hass, msg["rule_ids"])
        else:
            data, summary = template_dashboard(hass)
        if msg["to_file"]:
            return {"file": {"matterai_template": msg["kind"], "name": msg["name"], "description": msg["description"], "summary": summary, "data": data}}
        tid = await _central(hass).async_save_template(msg["kind"], msg["name"], msg["description"], data, summary)
        return {"id": tid}

    await _guard(connection, msg, run)


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/templates/use", vol.Optional("id"): str, vol.Optional("file"): dict}
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_templates_use(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Usa una plantilla del panel central o de un archivo.

    Automatizaciones: se suman pausadas. Dashboard: se devuelve para cargarlo en el editor (no se guarda solo).
    """
    from .backup import BackupError, async_use_automations  # noqa: PLC0415

    async def run():
        if msg.get("id"):
            tpl = await _central(hass).async_template(msg["id"])
            kind, data = tpl.get("kind"), tpl.get("data") or {}
        elif msg.get("file"):
            kind, data = msg["file"].get("matterai_template"), msg["file"].get("data") or {}
        else:
            raise BackupError("Elegí una plantilla")
        if kind == "automations":
            return {"kind": kind, **await async_use_automations(hass, data)}
        if kind == "dashboard":
            if not isinstance(data.get("config"), dict):
                raise BackupError("Esa plantilla no trae un dashboard")
            return {"kind": kind, "config": data["config"]}
        raise BackupError("Ese archivo no es una plantilla de MatterAI")

    await _guard(connection, msg, run)


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/templates/remap", vol.Required("rule_ids"): [str], vol.Required("mapping"): {str: str}}
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_templates_remap(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Empareja los equipos de una plantilla con los de esta casa."""
    from .backup import async_remap  # noqa: PLC0415

    await _guard(connection, msg, lambda: async_remap(hass, msg["rule_ids"], msg["mapping"]))


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/backup/restore_some", vol.Required("data"): dict, vol.Required("rule_ids"): [str]}
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_backup_restore_some(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Restaura sólo las automatizaciones elegidas de una copia (el resto queda como está)."""
    from .backup import async_restore_some  # noqa: PLC0415

    async def run():
        return {"restored": await async_restore_some(hass, msg["data"], msg["rule_ids"])}

    await _guard(connection, msg, run)


# ------------------------------------------------------------------ mantenimiento del sistema


def _watchdog(hass: HomeAssistant):
    wd = _rt(hass).get("watchdog")
    if wd is None:
        raise HomeAssistantError("El mantenimiento del sistema todavía está iniciando")
    return wd


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/watchdog", vol.Optional("check"): bool, vol.Optional("maintenance_minutes"): vol.All(int, vol.Range(min=0, max=1440))}
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_watchdog(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Estado del mantenimiento del sistema; también fuerza un chequeo o activa/desactiva el modo mantenimiento."""

    async def run():
        wd = _watchdog(hass)
        if "maintenance_minutes" in msg:
            await wd.async_set_maintenance(msg["maintenance_minutes"] or None)
        elif msg.get("check"):
            await wd.async_check(force=True)
        return wd.as_dict()

    await _guard(connection, msg, run)


from .app_devices import WS_COMMANDS as APP_WS  # noqa: E402
from .pairing import WS_COMMANDS as PAIR_WS  # noqa: E402
from .audit import WS_COMMANDS as AUDIT_WS  # noqa: E402

COMMANDS = (*APP_WS, *PAIR_WS, *AUDIT_WS, ws_watchdog, ws_templates_remap, ws_backup_restore_some, ws_backup_export, ws_backup_restore, ws_backup_send, ws_templates_list, ws_templates_save, ws_templates_use, ws_voice_log, ws_voice_audio, ws_voice, ws_config, ws_config_subscribe, ws_config_save, ws_pairing, ws_status, ws_heartbeat)
