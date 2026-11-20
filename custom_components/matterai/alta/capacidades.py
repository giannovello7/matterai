"""Qué es un equipo recién agregado, en castellano: tipo principal y todas sus funciones.

Sirve igual para Zigbee2MQTT, ZHA, Matter y WiFi: se mira lo que Home Assistant creó (dominio y device_class de cada
entidad). Con Zigbee2MQTT, además, lo que contó el equipo al unirse (`exposes`), por si las entidades todavía no están.
"""

from __future__ import annotations

from typing import Any

# función → cómo se la nombra
FUNCIONES: dict[str, str] = {
    "luz": "Luz",
    "dimmer": "Luz regulable",
    "color": "Luz de colores",
    "persiana": "Cortina o persiana",
    "porton": "Portón",
    "clima": "Aire acondicionado / climatizador",
    "cerradura": "Cerradura",
    "enchufe": "Enchufe",
    "interruptor": "Interruptor",
    "ventilador": "Ventilador",
    "sirena": "Sirena",
    "valvula": "Válvula",
    "puerta": "Sensor de apertura (puerta o ventana)",
    "movimiento": "Sensor de movimiento",
    "presencia": "Sensor de presencia",
    "humo": "Detector de humo o gas",
    "agua": "Sensor de pérdida de agua",
    "boton": "Botón",
    "temperatura": "Sensor de temperatura",
    "humedad": "Sensor de humedad",
    "luminosidad": "Sensor de luz",
    "medicion": "Medición de consumo",
    "vibracion": "Sensor de vibración",
    "bateria": "Batería",
}
# el tipo principal es la primera función de esta lista que tenga
PRIORIDAD = ("luz", "persiana", "porton", "clima", "cerradura", "enchufe", "interruptor", "ventilador", "sirena", "valvula",
             "puerta", "movimiento", "presencia", "humo", "agua", "boton", "temperatura", "humedad", "luminosidad",
             "medicion", "vibracion", "bateria")
# para el nombre sugerido («Sensor puerta Cocina»)
NOMBRE_CORTO: dict[str, str] = {
    "luz": "Luz", "persiana": "Cortina", "porton": "Portón", "clima": "Aire", "cerradura": "Cerradura", "enchufe": "Enchufe",
    "interruptor": "Interruptor", "ventilador": "Ventilador", "sirena": "Sirena", "valvula": "Válvula", "puerta": "Sensor puerta",
    "movimiento": "Sensor movimiento", "presencia": "Sensor presencia", "humo": "Detector humo", "agua": "Sensor agua",
    "boton": "Botón", "temperatura": "Sensor temperatura", "humedad": "Sensor humedad", "luminosidad": "Sensor luz",
    "medicion": "Medidor", "vibracion": "Sensor vibración", "bateria": "Equipo",
}

_BINARY = {
    "door": "puerta", "window": "puerta", "opening": "puerta", "garage_door": "puerta",
    "motion": "movimiento", "occupancy": "presencia", "presence": "presencia",
    "smoke": "humo", "gas": "humo", "carbon_monoxide": "humo", "moisture": "agua", "vibration": "vibracion",
}
_SENSOR = {
    "temperature": "temperatura", "humidity": "humedad", "illuminance": "luminosidad",
    "power": "medicion", "energy": "medicion", "current": "medicion", "battery": "bateria",
}
_DOMAIN = {
    "light": "luz", "cover": "persiana", "climate": "clima", "lock": "cerradura", "switch": "interruptor",
    "fan": "ventilador", "siren": "sirena", "valve": "valvula", "event": "boton",
}
# Zigbee2MQTT: nombres de `exposes`
_EXPOSE = {
    "contact": "puerta", "occupancy": "movimiento", "presence": "presencia", "temperature": "temperatura",
    "humidity": "humedad", "illuminance": "luminosidad", "illuminance_lux": "luminosidad", "power": "medicion",
    "energy": "medicion", "action": "boton", "smoke": "humo", "gas": "humo", "water_leak": "agua",
    "vibration": "vibracion", "battery": "bateria",
}
_EXPOSE_TYPE = {"light": "luz", "switch": "interruptor", "cover": "persiana", "lock": "cerradura", "climate": "clima", "fan": "ventilador"}
_COLOR_MODES = {"hs", "xy", "rgb", "rgbw", "rgbww"}


def funcion_de_entidad(entity_id: str, device_class: str | None, attrs: dict[str, Any] | None = None) -> list[str]:
    """Las funciones que aporta una entidad (puede ser más de una: una luz regulable de colores)."""
    domain, _, obj = entity_id.partition(".")
    attrs = attrs or {}
    if domain == "binary_sensor":
        f = _BINARY.get(device_class or "")
        return [f] if f else []
    if domain == "sensor":
        if device_class in _SENSOR:
            return [_SENSOR[device_class]]
        return ["boton"] if obj.endswith("_action") else []  # Zigbee2MQTT viejo: el botón como sensor «action»
    if domain == "cover":
        return ["porton"] if device_class in ("garage", "gate") else ["persiana"]
    if domain == "switch" and device_class == "outlet":
        return ["enchufe"]
    if domain == "light":
        out = ["luz"]
        modes = set(attrs.get("supported_color_modes") or [])
        if modes - {"onoff"}:
            out.append("dimmer")
        if modes & _COLOR_MODES:
            out.append("color")
        return out
    f = _DOMAIN.get(domain)
    return [f] if f else []


def _funciones_exposes(exposes: list[Any]) -> list[str]:
    out: list[str] = []

    def walk(items: list[Any]) -> None:
        for x in items or []:
            if not isinstance(x, dict):
                continue
            t = x.get("type")
            if t in _EXPOSE_TYPE:
                out.append(_EXPOSE_TYPE[t])
                feats = {f.get("name") for f in x.get("features") or [] if isinstance(f, dict)}
                if t == "light" and "brightness" in feats:
                    out.append("dimmer")
                if t == "light" and feats & {"color_xy", "color_hs"}:
                    out.append("color")
                continue
            name = x.get("name") or x.get("property")
            if name in _EXPOSE:
                out.append(_EXPOSE[name])
            if x.get("features"):
                walk(x["features"])

    walk(exposes)
    return out


def _orden(funcs: list[str]) -> list[str]:
    seen = set(funcs)
    # un enchufe con medición sigue siendo un enchufe (Zigbee2MQTT no marca «outlet»)
    if "interruptor" in seen and "medicion" in seen:
        seen.discard("interruptor")
        seen.add("enchufe")
    return [f for f in PRIORIDAD if f in seen] + sorted(seen - set(PRIORIDAD))


def tipo_texto(funcs: list[str]) -> str:
    """«Sensor de temperatura y humedad», «Enchufe con medición de consumo», «Luz regulable de colores»…"""
    if not funcs:
        return "Equipo"
    main = funcs[0]
    if main == "luz":
        return "Luz regulable de colores" if "color" in funcs else "Luz regulable" if "dimmer" in funcs else "Luz"
    if main == "temperatura" and "humedad" in funcs:
        return "Sensor de temperatura y humedad"
    if main in ("enchufe", "interruptor") and "medicion" in funcs:
        return f"{FUNCIONES[main]} con medición de consumo"
    if main == "movimiento" and "luminosidad" in funcs:
        return "Sensor de movimiento y luz"
    return FUNCIONES.get(main, "Equipo")


def normalizar(entidades: list[dict[str, Any]], exposes: list[Any] | None = None) -> dict[str, Any]:
    """entidades: [{entity_id, device_class, attrs, tecnica}] → {tipo, tipo_texto, funciones, entidades por función}."""
    por_funcion: dict[str, list[str]] = {}
    funcs: list[str] = []
    for e in entidades:
        fs = funcion_de_entidad(e["entity_id"], e.get("device_class"), e.get("attrs"))
        if e.get("tecnica") and fs != ["bateria"]:
            continue  # las de diagnóstico/configuración no cuentan (salvo la batería)
        for f in fs:
            funcs.append(f)
            por_funcion.setdefault(f, []).append(e["entity_id"])
    funcs += _funciones_exposes(exposes or [])
    orden = _orden(funcs)
    if "enchufe" in orden and "interruptor" in por_funcion and "enchufe" not in por_funcion:
        por_funcion["enchufe"] = por_funcion.pop("interruptor")
    return {
        "tipo": orden[0] if orden else "desconocido",
        "tipo_texto": tipo_texto(orden),
        "funciones": [{"id": f, "texto": FUNCIONES.get(f, f)} for f in orden],
        "entidades": por_funcion,
    }


_SUFIJO_DC = {
    "battery": "batería", "temperature": "temperatura", "humidity": "humedad", "illuminance": "luz", "power": "consumo",
    "energy": "energía", "current": "corriente", "voltage": "tensión", "motion": "movimiento", "occupancy": "presencia",
    "door": "apertura", "window": "apertura", "opening": "apertura", "moisture": "agua", "smoke": "humo", "vibration": "vibración",
}


def sufijo(entity_id: str, device_class: str | None) -> str:
    """Qué agregarle al nombre del equipo para una entidad que no es la principal («… batería», «… consumo»)."""
    if device_class in _SUFIJO_DC:
        return _SUFIJO_DC[device_class]
    fs = funcion_de_entidad(entity_id, device_class)
    if fs == ["boton"]:
        return "botón"
    return ""


def nombre_sugerido(tipo: str, area: str | None) -> str:
    base = NOMBRE_CORTO.get(tipo, "Equipo")
    return f"{base} {area}".strip() if area else base
