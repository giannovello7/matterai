"""MatterAI: todo lo que necesita una casa para la app MatterAI, en una sola integración.

- Sirve la tarjeta del dashboard y la registra sola (no más copiar archivos ni subir «?v=»).
- Guarda la configuración del dashboard (sin YAML) y la edita el instalador desde el panel MatterAI.
- Crea el usuario de la app (sin admin) y arma el link/QR para vincular el celular del cliente.
- Le avisa al panel central del instalador que la casa está viva y si hay algo para atender.
- Automatizaciones (antes «MatterAI Escenas»): escenas, automáticas, inteligentes y los equipos
  del instalador (portón inteligente, sensor de ocupación). Ver escenas/.
"""

from __future__ import annotations

import logging
import os

from homeassistant.components import frontend, panel_custom, websocket_api
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.start import async_at_started
from homeassistant.helpers.typing import ConfigType

from .const import (
    CARD_FILENAME,
    LOADER_FILENAME,
    CONF_AI_KEY,
    CONF_VOICE_MODE,
    CONF_CENTRAL_KEY,
    CONF_CENTRAL_URL,
    CONF_NAME,
    CONF_URL,
    DEFAULT_CENTRAL_URL,
    DOMAIN,
    PANEL_ELEMENT,
    PANEL_FILENAME,
    PANEL_ICON,
    PANEL_TITLE,
    PANEL_URL_PATH,
    STATIC_URL,
    VERSION,
)
from .dashboard import Dashboard
from .escenas import PLATFORMS, async_setup_escenas, async_setup_escenas_entry, async_unload_escenas
from .health import Heartbeat
from .house import House
from .websocket import COMMANDS

_LOGGER = logging.getLogger(__name__)
# automatizaciones (switch, button, binary_sensor, cover) + mantenimiento del sistema (sensor)
ALL_PLATFORMS = [*PLATFORMS, "sensor"]
CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "frontend")


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    hass.data.setdefault(DOMAIN, {})
    try:
        from homeassistant.components.http import StaticPathConfig  # noqa: PLC0415

        await hass.http.async_register_static_paths([StaticPathConfig(STATIC_URL, FRONTEND_DIR, False)])
    except ImportError:  # HA < 2024.7
        hass.http.register_static_path(STATIC_URL, FRONTEND_DIR, False)
    for command in COMMANDS:
        websocket_api.async_register_command(hass, command)
    # Si en esta casa sigue instalada la integración aparte «MatterAI Escenas», las automatizaciones
    # las maneja ella: correr las dos haría que cada automatización se ejecute dos veces.
    if not _escenas_aparte(hass):
        await async_setup_escenas(hass)
    return True


@callback
def _escenas_aparte(hass: HomeAssistant) -> bool:
    """¿Está instalada todavía la integración vieja «MatterAI Escenas»?"""
    return bool(hass.config_entries.async_entries("matterai_escenas"))


async def _version_tag(hass: HomeAssistant, filename: str) -> str:
    """Versión + fecha del archivo: cada actualización cambia la URL y el navegador baja la nueva."""
    mtime = await hass.async_add_executor_job(os.path.getmtime, os.path.join(FRONTEND_DIR, filename))
    return f"{VERSION}-{int(mtime)}"


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    rt = hass.data.setdefault(DOMAIN, {})
    house = House(hass)
    await house.async_load()
    dashboard = Dashboard(hass)
    await dashboard.async_load()
    rt.update(entry=entry, house=house, dashboard=dashboard)

    # el usuario y el acceso de la app quedan listos desde el primer momento
    await house.async_token()

    # la página carga el cargador (dirección fija); él trae la última versión de la tarjeta aunque no se reinicie HA
    card_url = f"{STATIC_URL}/{LOADER_FILENAME}?f={CARD_FILENAME}&v={await _version_tag(hass, LOADER_FILENAME)}"
    rt["card_url"] = card_url
    frontend.add_extra_js_url(hass, card_url)

    async def _resource(_hass: HomeAssistant) -> None:
        await _async_register_resource(hass, card_url)

    entry.async_on_unload(async_at_started(hass, _resource))

    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=PANEL_URL_PATH,
        webcomponent_name=PANEL_ELEMENT,
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        module_url=f"{STATIC_URL}/{LOADER_FILENAME}?f={PANEL_FILENAME}&v={await _version_tag(hass, LOADER_FILENAME)}",
        require_admin=True,  # sólo el instalador
        config={"card_url": card_url},
    )

    opts = {**entry.data, **entry.options}
    voice_mode = opts.get(CONF_VOICE_MODE) or "auto"
    if voice_mode != "off":  # gratis siempre; con IA si hay clave y el modo lo permite
        from .voice import VoiceBrain  # noqa: PLC0415

        rt["voice"] = VoiceBrain(hass, opts.get(CONF_AI_KEY), voice_mode)
        from .voice_log import VoiceLog  # noqa: PLC0415

        rt["voice"].log = VoiceLog(hass)
        await rt["voice"].log.async_load()
    if opts.get(CONF_CENTRAL_KEY):
        hb = Heartbeat(
            hass,
            house.house_id,
            opts.get(CONF_NAME, ""),
            opts.get(CONF_URL, ""),
            opts.get(CONF_CENTRAL_URL) or DEFAULT_CENTRAL_URL,
            opts[CONF_CENTRAL_KEY],
        )
        rt["heartbeat"] = hb

        async def _start(_hass: HomeAssistant) -> None:
            hb.start()

        entry.async_on_unload(async_at_started(hass, _start))
        entry.async_on_unload(hb.stop)

    # automatizaciones: el motor primero, después sus entidades (portón, botones, sensores)
    if _escenas_aparte(hass):
        rt["escenas_conflict"] = True
        _LOGGER.warning("MatterAI Escenas sigue instalada: las automatizaciones las maneja ella hasta que la elimines")
        from homeassistant.components import persistent_notification  # noqa: PLC0415

        persistent_notification.async_create(
            hass,
            "Las automatizaciones ahora vienen dentro de MatterAI. Eliminá la integración «MatterAI Escenas» "
            "(Ajustes → Dispositivos y servicios) y reiniciá: tus automatizaciones se mantienen.",
            title="MatterAI: falta eliminar MatterAI Escenas",
            notification_id="matterai_escenas_aparte",
        )
    else:
        await async_setup_escenas_entry(hass, entry)
        rt["escenas_on"] = True

    # mantenimiento del sistema: vigila Zigbee2MQTT, Mosquitto… y los recupera solo
    from .watchdog import Watchdog  # noqa: PLC0415

    rt["watchdog"] = Watchdog(hass)

    async def _start_watchdog(_hass: HomeAssistant) -> None:
        await rt["watchdog"].async_start()

    entry.async_on_unload(async_at_started(hass, _start_watchdog))
    entry.async_on_unload(rt["watchdog"].stop)
    await hass.config_entries.async_forward_entry_setups(entry, ALL_PLATFORMS)

    entry.async_on_unload(entry.add_update_listener(_async_options_updated))
    return True


async def _async_options_updated(hass: HomeAssistant, entry: ConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    rt0 = hass.data.get(DOMAIN, {})
    if not await hass.config_entries.async_unload_platforms(entry, ALL_PLATFORMS):
        return False
    if rt0.get("escenas_on"):
        await async_unload_escenas(hass)
    frontend.async_remove_panel(hass, PANEL_URL_PATH)
    rt = hass.data.get(DOMAIN, {})
    if rt.get("card_url"):
        try:
            frontend.remove_extra_js_url(hass, rt["card_url"])
        except (KeyError, ValueError):  # ya no estaba (frontend recién iniciado o quitado antes)
            pass
    for key in ("entry", "house", "dashboard", "heartbeat", "card_url", "voice", "escenas_on", "escenas_conflict", "watchdog"):
        rt.pop(key, None)
    return True


async def _async_register_resource(hass: HomeAssistant, url: str) -> None:
    """La tarjeta como recurso de los paneles, con la versión justa.

    Si ya había una copia vieja (/local/matterai-home/matterai-home-card.js?v=…), se reemplaza:
    así no conviven dos versiones y nunca más hay que cambiar el «?v=» a mano.
    """
    lovelace = hass.data.get("lovelace")
    resources = getattr(lovelace, "resources", None)
    if resources is None and isinstance(lovelace, dict):
        resources = lovelace.get("resources")
    if resources is None or not hasattr(resources, "async_create_item"):
        return  # paneles en modo YAML: queda cargada igual con add_extra_js_url
    try:
        if not getattr(resources, "loaded", True):
            await resources.async_load()
            resources.loaded = True
        mine = None
        for item in list(resources.async_items()):
            full = str(item.get("url", ""))
            base = full.split("?")[0]
            if base.endswith("/" + CARD_FILENAME) or (base.endswith("/" + LOADER_FILENAME) and PANEL_FILENAME not in full):
                if mine is None:
                    mine = item
                    if item.get("url") != url:
                        await resources.async_update_item(item["id"], {"res_type": "module", "url": url})
                else:  # copias repetidas
                    await resources.async_delete_item(item["id"])
        if mine is None:
            await resources.async_create_item({"res_type": "module", "url": url})
    except Exception:  # noqa: BLE001 - si falla, la tarjeta igual carga con add_extra_js_url
        _LOGGER.debug("No se pudo registrar el recurso de la tarjeta", exc_info=True)


@callback
def async_get_runtime(hass: HomeAssistant):
    return hass.data.get(DOMAIN)
