"""Formato de un dashboard (vista): tarjetas, acciones de cada botón, orientación y plano.

Lo arma el instalador en el editor del panel MatterAI; la app lo dibuja con el mismo motor (app/vista.js).
Todo se valida acá: tipos de tarjeta conocidos, entidades con formato válido, acciones permitidas, tamaños
máximos. Si mañana se agrega un tipo de tarjeta nuevo, se suma a BLOCK_TYPES (y al motor de la app).
"""

from __future__ import annotations

import json
import re
from typing import Any

import voluptuous as vol

from homeassistant.helpers import config_validation as cv

# tarjetas disponibles (el editor muestra su catálogo; la app sabe dibujarlas)
BLOCK_TYPES = (
    "kpis",       # resumen: alarma, portón, luces, temperatura, aires, consumo… (3 en el celular, hasta 6 en la tablet)
    "featured",   # cámara grande con botón (portón, puerta)
    "rooms",      # ambientes (lista en el celular, grilla en la tablet)
    "scenes",     # escenas / scripts
    "buttons",    # botones a elección: cada uno con su equipo y su acción
    "camera",     # cámara con acciones (portero)
    "alarm",      # botón grande de la alarma
    "away",       # modo ausente (una escena, script o interruptor)
    "routines",   # rutinas (automatizaciones con su interruptor)
    "music",      # lo que está sonando
    "lock",       # cerradura con su historial
    "plan",       # el plano o render de la casa (tablet)
    "clock",      # hora, fecha y clima grandes (tablet)
    # desde la 2.16
    "weather",    # clima grande con su pronóstico
    "climate",    # termostato de un aire (temperatura, modo, prender/apagar)
    "covers",     # cortinas / persianas con su posición
    "lights",     # luces con su brillo
    "energy",     # consumo con el gráfico de las últimas 24 h
    "sensor",     # un sensor con medidor
    "people",     # quién está en casa
    "text",       # texto o separador
    "image",      # una imagen (con acción al tocar)
    "activity",   # acceso a la Actividad (toda la casa o un ambiente), desde la 2.21
    "frigate",    # cámaras en vivo con el visor de Frigate (Advanced Camera Card), desde la 2.22.2
    # desde la 2.23
    "openings",   # puertas y ventanas: qué quedó abierto
    "agenda",     # lo que viene hoy y mañana en los calendarios
    "irrigation", # riego: válvulas, interruptores de riego y programas de MatterAI
    "batteries",  # pilas bajas (cfg.max: el límite en %)
)
SIZES = ("full", "half")
COND_TYPES = ("state", "not_state", "night", "day", "music", "alarm_armed", "alarm_off", "someone_home", "nobody_home")
SCREENS = ("agenda", "clima", "musica", "actividad", "camaras", "seguridad", "avisos", "menu", "casa", "luces", "automatizaciones", "aberturas")
ACTIONS = ("none", "toggle", "more_info", "room", "screen", "service")
KPI_KINDS = ("alarm", "lights", "temp", "acs", "power", "curtains", "entity", "people")
MEDIA_RE = re.compile(r"^(/api/matterai/media/[a-f0-9]{16}\.(jpg|png|webp)|/local/[\w./-]{1,160})$")
MAX_VIEW_BYTES = 200_000

_name = vol.All(str, vol.Length(max=60))
_icon = vol.All(str, vol.Match(r"^[a-z0-9_-]{0,30}$"))
_scalar = vol.Any(str, int, float, bool, None)


def _service(v: Any) -> str:
    v = str(v)
    if not re.match(r"^[a-z_]{2,40}\.[a-z0-9_]{2,60}$", v):
        raise vol.Invalid("servicio inválido (dominio.servicio)")
    return v


ACTION = vol.Schema({
    vol.Required("type", default="none"): vol.In(ACTIONS),
    vol.Optional("entity"): vol.Any(None, cv.entity_id),
    vol.Optional("room"): vol.Any(None, _name),
    vol.Optional("screen"): vol.Any(None, vol.In(SCREENS)),
    vol.Optional("service"): vol.Any(None, _service),
    vol.Optional("data"): vol.All(dict, vol.Length(max=10), {vol.All(str, vol.Length(max=40)): vol.Any(_scalar, [_scalar])}),
    vol.Optional("confirm"): bool,
}, extra=vol.REMOVE_EXTRA)

ITEM = vol.Schema({
    vol.Optional("name"): vol.Any(None, _name),
    vol.Optional("icon"): vol.Any(None, _icon),
    vol.Optional("entity"): vol.Any(None, cv.entity_id),
    vol.Optional("kind"): vol.Any(None, vol.In(KPI_KINDS)),
    vol.Optional("mode"): vol.Any(None, vol.In(["toggle", "run"])),  # rutinas: interruptor o «Ejecutar»
    vol.Optional("tap"): ACTION,
    vol.Optional("hold"): ACTION,
}, extra=vol.REMOVE_EXTRA)

CFG = vol.Schema({
    vol.Optional("entity"): vol.Any(None, cv.entity_id),        # cámara, cerradura, alarma, modo ausente
    vol.Optional("gate"): vol.Any(None, cv.entity_id),          # el botón de la cámara destacada
    vol.Optional("entities"): vol.All([cv.entity_id], vol.Length(max=24)),  # escenas, rutinas
    vol.Optional("rooms"): vol.All([_name], vol.Length(max=24)),
    vol.Optional("items"): vol.All([ITEM], vol.Length(max=24)),  # botones, resumen
    vol.Optional("auto"): bool,                                 # true: que lo elija la app según la casa
    vol.Optional("style"): vol.Any(None, vol.In(["list", "grid", "big", "compact", "separator"])),
    # desde la 2.16
    vol.Optional("cols"): vol.Any(None, vol.All(vol.Coerce(int), vol.Range(min=1, max=4))),  # botones por fila
    vol.Optional("text"): vol.Any(None, vol.All(str, vol.Length(max=600))),               # tarjeta de texto
    vol.Optional("image"): vol.Any(None, lambda v: _media(v)),                            # tarjeta de imagen
    vol.Optional("min"): vol.Any(None, vol.Coerce(float)),                                # medidor del sensor
    vol.Optional("max"): vol.Any(None, vol.Coerce(float)),
    vol.Optional("tap"): ACTION,                                                          # acción de la tarjeta
    vol.Optional("video"): vol.Any(None, vol.In(["live", "photo"])),                      # cámara: video en vivo o foto
}, extra=vol.REMOVE_EXTRA)

COND = vol.Schema({
    vol.Required("type"): vol.In(COND_TYPES),
    vol.Optional("entity"): vol.Any(None, cv.entity_id),
    vol.Optional("state"): vol.Any(None, vol.All(str, vol.Length(max=40))),
}, extra=vol.REMOVE_EXTRA)

BLOCK = vol.Schema({
    vol.Required("id"): vol.All(str, vol.Match(r"^[\w-]{1,24}$")),
    vol.Required("type"): vol.In(BLOCK_TYPES),
    vol.Optional("title"): vol.Any(None, vol.All(str, vol.Length(max=40))),
    vol.Optional("col", default=0): vol.All(vol.Coerce(int), vol.Range(min=0, max=2)),
    vol.Optional("size"): vol.Any(None, vol.In(SIZES)),                 # ancho completo o media columna
    vol.Optional("show"): vol.Any(None, vol.All([COND], vol.Length(max=6))),  # se ve sólo si se cumple todo
    vol.Optional("cfg", default=dict): CFG,
}, extra=vol.REMOVE_EXTRA)


def _point(v: Any) -> list[float]:
    if not isinstance(v, (list, tuple)) or len(v) != 2:
        raise vol.Invalid("punto inválido")
    x, y = float(v[0]), float(v[1])
    if not (0 <= x <= 1 and 0 <= y <= 1):
        raise vol.Invalid("el punto tiene que estar dentro de la imagen")
    return [round(x, 4), round(y, 4)]


ZONE = vol.Schema({
    vol.Required("name"): vol.All(str, vol.Length(min=1, max=40)),
    vol.Optional("room"): vol.Any(None, _name),
    vol.Optional("lights", default=list): vol.All([cv.entity_id], vol.Length(max=24)),
    vol.Required("poly"): vol.All([_point], vol.Length(min=3, max=40)),
    vol.Optional("pin"): vol.Any(None, _point),
}, extra=vol.REMOVE_EXTRA)


def _media(v: Any) -> str:
    v = str(v)
    if not MEDIA_RE.match(v) or ".." in v:
        raise vol.Invalid("imagen inválida")
    return v


PLAN = vol.Schema({
    vol.Optional("image"): vol.Any(None, _media),     # apagado / de noche
    vol.Optional("image_on"): vol.Any(None, _media),  # con todas las luces prendidas
    vol.Optional("image_day"): vol.Any(None, _media), # de día (opcional)
    vol.Optional("aspect"): vol.Any(None, vol.All(vol.Coerce(float), vol.Range(min=0.2, max=5))),
    vol.Optional("zones", default=list): vol.All([ZONE], vol.Length(max=60)),
}, extra=vol.REMOVE_EXTRA)


# botones posibles de la barra de abajo («voice» es el micrófono)
DOCK_KEYS = ("top", "camaras", "musica", "actividad", "voice", "agenda", "casa", "menu", "luces", "clima", "seguridad", "automatizaciones")

HEADER = vol.Schema({
    vol.Optional("clock"): bool,    # hora y fecha
    vol.Optional("weather"): bool,  # clima
    vol.Optional("bell"): bool,     # campanita de avisos
    vol.Optional("menu"): bool,     # menú
    vol.Optional("casa"): bool,     # botón «Toda la casa» al final del inicio del celular
}, extra=vol.REMOVE_EXTRA)


# estilos prearmados y degradés de fondo (las mismas claves que app/vista.js)
STYLES = ("matterai", "apple", "cristal")
GRADIENTS = ("aurora", "atardecer", "oceano", "bosque", "noche", "arena", "nube")

BG = vol.Schema({
    vol.Required("kind"): vol.In(["none", "color", "gradient", "image"]),
    vol.Optional("color"): vol.Any(None, vol.Match(r"^#[0-9a-fA-F]{6}$")),
    vol.Optional("gradient"): vol.Any(None, vol.In(GRADIENTS)),
    vol.Optional("image"): vol.Any(None, _media),
    vol.Optional("dim"): vol.Any(None, vol.All(vol.Coerce(float), vol.Range(min=0, max=0.8))),  # cuánto se oscurece la imagen
}, extra=vol.REMOVE_EXTRA)


def layout_schema(max_blocks: int) -> vol.Schema:
    """Un diseño (el del celular o el de la tablet) de un dashboard."""
    return vol.Schema({
        vol.Optional("blocks"): vol.Any(None, vol.All([BLOCK], vol.Length(max=max_blocks))),
        vol.Optional("orientation"): vol.Any(None, vol.In(["landscape", "portrait", "auto"])),
        vol.Optional("header"): vol.Any(None, HEADER),                                       # desde la 2.20
        vol.Optional("dock"): vol.Any(None, vol.All([vol.In(DOCK_KEYS)], vol.Length(max=10))),
        vol.Optional("theme"): vol.Any(None, vol.In(["dark", "light", "auto"])),          # desde la 2.21: oscuro, claro o según el equipo
        vol.Optional("style"): vol.Any(None, vol.In(STYLES)),                             # desde la 2.23: estilo prearmado
        vol.Optional("bg"): vol.Any(None, BG),                                            # desde la 2.23: fondo propio
    }, extra=vol.REMOVE_EXTRA)


def check_size(view: dict[str, Any]) -> dict[str, Any]:
    if len(json.dumps(view, ensure_ascii=False)) > MAX_VIEW_BYTES:
        raise vol.Invalid("el dashboard es demasiado grande")
    lays = [view.get("blocks") or []] + [(lay or {}).get("blocks") or [] for lay in (view.get("layouts") or {}).values()]
    for blocks in lays:
        ids = [b["id"] for b in blocks]
        if len(ids) != len(set(ids)):
            raise vol.Invalid("hay tarjetas repetidas")
    return view
