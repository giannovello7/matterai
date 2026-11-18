"""Arma la integración «MatterAI Automatizaciones» sola (para clientes que usan sólo Home Assistant, sin la app).

Sale del MISMO código que la integración MatterAI (custom_components/matterai/escenas, sus plataformas y la tarjeta):
cada arreglo llega a las dos. Uso:

    python tools/escenas_sola.py [carpeta del repo matterai-escenas]

Copia todo a <repo>/custom_components/matterai_escenas con estos cambios:
- los servicios y entidades son del dominio «matterai_escenas» (en MatterAI son de «matterai»);
- la versión es la de MatterAI;
- sin lo que es de la app MatterAI (página Dispositivos, aviso al celular del portero por la app);
- su propia entrada en la barra lateral («Automatizaciones», también para no administradores).
"""
from __future__ import annotations

import json
import os
import re
import shutil
import sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(HERE, "custom_components", "matterai")
DST_REPO = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(HERE), "matterai-escenas")
DST = os.path.join(DST_REPO, "custom_components", "matterai_escenas")

KEEP = {"config_flow.py", "services.yaml", "strings.json", "translations", "brand", "manifest.json"}
PLATFORMS = ("switch", "button", "binary_sensor", "cover")


def read(path: str) -> str:
    with open(path, encoding="utf-8") as fh:
        return fh.read()


def write(path: str, text: str) -> None:
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(text)


def sub(text: str, old: str, new: str, name: str) -> str:
    if old not in text:
        raise SystemExit(f"{name}: no encontré «{old[:60]}» (¿cambió el código? actualizá este armador)")
    return text.replace(old, new)


def version() -> str:
    m = re.search(r'^VERSION = "([^"]+)"', read(os.path.join(SRC, "const.py")), re.M)
    return m.group(1)


def build() -> None:
    ver = version()
    if not os.path.isdir(DST):
        raise SystemExit(f"No está el repo de la integración sola en {DST}")
    # 1. borrar lo generado la vez anterior (queda lo propio: alta, traducciones, ícono)
    for name in os.listdir(DST):
        if name in KEEP:
            continue
        path = os.path.join(DST, name)
        shutil.rmtree(path) if os.path.isdir(path) else os.remove(path)

    # 2. el motor (escenas/) a la raíz del paquete; su __init__ pasa a core.py
    esc = os.path.join(SRC, "escenas")
    for name in sorted(os.listdir(esc)):
        if not name.endswith(".py"):
            continue
        text = read(os.path.join(esc, name))
        out = "core.py" if name == "__init__.py" else name
        if name == "const.py":
            text = sub(text, 'INTEGRATION = "matterai"', "INTEGRATION = DOMAIN", name)
            text = sub(text, "from ..const import VERSION as _MATTERAI_VERSION", f'_MATTERAI_VERSION = "{ver}"', name)
        if name == "__init__.py":
            text = sub(text, "        from .. import selection  # noqa: PLC0415\n        sel = selection.get(hass)\n        allowed = sel.allowed() if sel else None",
                       "        return None  # sola: no hay página Dispositivos de la app", name)
            text = sub(text, "        from .. import selection  # noqa: PLC0415, F401\n    except ImportError:\n        return False\n    return True",
                       "        pass\n    except ImportError:\n        return False\n    return False  # sola: sin la app MatterAI", name)
            text = sub(text, 'os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", CARD_FILENAME)',
                       'os.path.join(os.path.dirname(__file__), "frontend", CARD_FILENAME)', name)
        if name == "doorbell.py":
            text = sub(text, "from ..app_devices import fire_command",
                       "def fire_command(*_args, **_kwargs) -> None:\n    \"\"\"Sola: sin la app MatterAI no hay llamada al celular (los avisos van igual).\"\"\"", name)
        if "from .." in text:
            raise SystemExit(f"{name}: todavía usa algo de MatterAI («from ..»)")
        write(os.path.join(DST, out), text)

    # 3. las plataformas (portón inteligente, interruptores de escenas, botones, ocupación)
    for p in PLATFORMS:
        text = read(os.path.join(SRC, f"{p}.py"))
        text = text.replace("from .escenas.", "from .")
        # el control de servicios (watchdog) es de MatterAI: la sola no lo tiene
        text = text.replace("from .watchdog_entities import async_setup_watchdog_platform\n", "")
        text = re.sub(r"\n    async_setup_watchdog_platform\(hass, entry, async_add_entities, \"\w+\"\)", "", text)
        if "from .." in text or "escenas" in text.replace("matterai_escenas", ""):
            raise SystemExit(f"{p}.py: usa algo de MatterAI que la integración sola no tiene")
        write(os.path.join(DST, f"{p}.py"), text)

    # cada «from .algo import» tiene que existir en el paquete armado
    mods = {n[:-3] for n in os.listdir(DST) if n.endswith(".py")}
    for name in sorted(mods):
        for mod in re.findall(r"^\s*from \.(\w+) import", read(os.path.join(DST, f"{name}.py")), re.M):
            if mod not in mods:
                raise SystemExit(f"{name}.py usa «.{mod}», que es de MatterAI y la integración sola no tiene")

    # 4. la tarjeta
    os.makedirs(os.path.join(DST, "frontend"), exist_ok=True)
    shutil.copy2(os.path.join(SRC, "frontend", "matterai-escenas-card.js"), os.path.join(DST, "frontend", "matterai-escenas-card.js"))

    # 5. la entrada de Home Assistant
    write(os.path.join(DST, "__init__.py"), INIT)

    # 6. versión
    mpath = os.path.join(DST, "manifest.json")
    man = json.loads(read(mpath))
    man.update({"name": "MatterAI Automatizaciones", "version": ver})
    write(mpath, json.dumps(man, ensure_ascii=False, indent=2) + "\n")
    print(f"Listo: MatterAI Automatizaciones {ver} en {DST}")


INIT = '''"""MatterAI Automatizaciones (sola): escenas y automatizaciones fáciles, para clientes que usan sólo Home Assistant.

Este paquete lo ARMA tools/escenas_sola.py del repo de la integración MatterAI: no se edita a mano.
"""

from __future__ import annotations

import logging

from homeassistant.components import frontend, panel_custom
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType

from .const import (
    CONF_SIDEBAR,
    CONF_SIDEBAR_ICON,
    CONF_SIDEBAR_TITLE,
    DEFAULT_SIDEBAR_ICON,
    DEFAULT_SIDEBAR_TITLE,
    DOMAIN,
    PANEL_ELEMENT,
    PANEL_URL_PATH,
)
from .core import PLATFORMS, async_setup_escenas, async_setup_escenas_entry, async_unload_escenas

_LOGGER = logging.getLogger(__name__)
CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    if hass.config_entries.async_entries("matterai"):
        # en una casa con MatterAI las automatizaciones ya vienen adentro: no se arranca dos veces
        _LOGGER.warning("MatterAI ya trae las automatizaciones: desinstalá «MatterAI Automatizaciones»")
        return True
    await async_setup_escenas(hass)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    if hass.config_entries.async_entries("matterai"):
        return False
    await async_setup_escenas_entry(hass, entry)
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    await _async_register_panel(hass, entry)
    entry.async_on_unload(entry.add_update_listener(_async_options_updated))
    return True


async def _async_register_panel(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """«Automatizaciones» en la barra lateral, también para los usuarios que no son administradores."""
    if not entry.options.get(CONF_SIDEBAR, True):
        return
    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=PANEL_URL_PATH,
        webcomponent_name=PANEL_ELEMENT,
        sidebar_title=entry.options.get(CONF_SIDEBAR_TITLE) or DEFAULT_SIDEBAR_TITLE,
        sidebar_icon=entry.options.get(CONF_SIDEBAR_ICON) or DEFAULT_SIDEBAR_ICON,
        module_url=hass.data[f"{DOMAIN}_js"],
        require_admin=False,
        config={},
    )
    hass.data[f"{DOMAIN}_panel"] = True


@callback
def _remove_panel(hass: HomeAssistant) -> None:
    if hass.data.pop(f"{DOMAIN}_panel", False):
        frontend.async_remove_panel(hass, PANEL_URL_PATH)


async def _async_options_updated(hass: HomeAssistant, entry: ConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    _remove_panel(hass)
    if ok:
        await async_unload_escenas(hass)
    return ok
'''

if __name__ == "__main__":
    build()
