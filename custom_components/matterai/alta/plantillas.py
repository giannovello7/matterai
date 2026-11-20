"""Automatizaciones sugeridas para un equipo recién agregado: siempre desde plantillas (la IA nunca escribe YAML).

Cada plantilla dice para qué tipo de equipo aplica, qué parámetros acepta (tipados, con mínimo, máximo y valor por
defecto) y arma una regla del motor de automatizaciones de MatterAI (escenas/) con el mismo formato que la tarjeta:
`ui` para volver a editarla desde la app + los disparadores, condiciones y acciones de HA ya armados. Se guarda con
`RuleManager.async_save` y los permisos de quien la crea: aparece, se edita y se borra en la app como las demás.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
import random
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er

from .core import AltaError

ESCENAS = "matterai_escenas"
COLORES = ("#4F8EF7", "#22C55E", "#F59E0B", "#EF4444", "#A855F7", "#14B8A6")


@dataclass
class Param:
    tipo: str  # entero · decimal · si_no · opcion
    texto: str
    default: Any
    min: float | None = None
    max: float | None = None
    opciones: list[str] = field(default_factory=list)

    def schema(self) -> dict[str, Any]:
        out: dict[str, Any] = {"tipo": self.tipo, "texto": self.texto, "default": self.default}
        if self.min is not None:
            out["min"] = self.min
        if self.max is not None:
            out["max"] = self.max
        if self.opciones:
            out["opciones"] = self.opciones
        return out

    def validar(self, value: Any) -> Any:
        if value is None or value == "":
            return self.default
        if self.tipo == "si_no":
            if isinstance(value, bool):
                return value
            if str(value).lower() in ("si", "sí", "true", "1"):
                return True
            if str(value).lower() in ("no", "false", "0"):
                return False
            raise AltaError(f"«{self.texto}» es sí o no.")
        if self.tipo == "opcion":
            if str(value) not in self.opciones:
                raise AltaError(f"«{self.texto}» tiene que ser una de: {', '.join(self.opciones)}.")
            return str(value)
        try:
            n = int(value) if self.tipo == "entero" else float(value)
        except (TypeError, ValueError):
            raise AltaError(f"«{self.texto}» tiene que ser un número.") from None
        if (self.min is not None and n < self.min) or (self.max is not None and n > self.max):
            raise AltaError(f"«{self.texto}» va de {self.min:g} a {self.max:g}.")
        return n


@dataclass
class Ctx:
    hass: HomeAssistant
    info: dict[str, Any]
    area_id: str | None
    area: str | None
    luces: list[str]  # luces del ambiente
    aires: list[str]  # aires del ambiente
    avisar: list[str]  # notify.<...> de los celulares con la app

    def ent(self, funcion: str) -> str | None:
        ids = (self.info.get("entidades") or {}).get(funcion) or []
        return ids[0] if ids else None

    @property
    def nombre(self) -> str:
        return self.info.get("nombre") or "el equipo"


@dataclass
class Plantilla:
    id: str
    titulo: str
    descripcion: str
    aplica: Callable[[Ctx], bool]
    params: dict[str, Param]
    construir: Callable[[Ctx, dict[str, Any]], dict[str, Any]]


# ---------------------------------------------------------------- piezas (mismo formato que la tarjeta)
def _mkey(eid: str) -> str:
    return eid.replace(".", "__")


def _regla(kind: str, name: str, icon: str, ui: dict[str, Any], triggers=(), conditions=(), actions=()) -> dict[str, Any]:
    return {"kind": kind, "name": name[:80], "icon": icon, "color": random.choice(COLORES), "enabled": True, "mode": "restart",
            "ui": ui, "triggers": list(triggers), "conditions": list(conditions), "actions": list(actions), "on_stop": []}


def _auto_ui(triggers, conditions, actions) -> dict[str, Any]:
    return {"triggers": triggers, "conditions": conditions, "cond_mode": "all", "actions": actions}


def _t_estado(eid: str, to: str | None = None, for_min: float = 0) -> tuple[dict, dict]:
    ui = {"type": "device", "entity": eid, **({"to": to} if to else {}), **({"for_min": for_min} if for_min and to else {})}
    tr: dict[str, Any] = {"platform": "state", "entity_id": eid, "not_from": ["unavailable", "unknown"], "id": "t0"}
    if to:
        tr["to"] = to
    else:
        tr["not_to"] = ["unavailable", "unknown"]
    if for_min and to:
        tr["for"] = {"minutes": for_min}
    return ui, tr


def _t_numero(eid: str, direccion: str, valor: float, for_min: float = 0) -> tuple[dict, dict]:
    ui = {"type": "device", "entity": eid, "dir": direccion, "value": valor, **({"for_min": for_min} if for_min else {})}
    tr: dict[str, Any] = {"platform": "numeric_state", "entity_id": eid, direccion: valor, "id": "t0"}
    if for_min:
        tr["for"] = {"minutes": for_min}
    return ui, tr


def _avisos(c: Ctx, titulo: str, mensaje: str) -> tuple[list[dict], list[dict]]:
    if not c.avisar:
        return ([{"type": "notify", "target": "persistent", "title": titulo, "message": mensaje}],
                [{"service": "persistent_notification.create", "data": {"title": titulo, "message": mensaje}}])
    ui = [{"type": "notify", "target": t.split(".", 1)[1], "title": titulo, "message": mensaje} for t in c.avisar]
    ha = [{"service": t, "data": {"message": mensaje, "title": titulo}} for t in c.avisar]
    return ui, ha


def _luces_accion(c: Ctx, svc: str, off_after: float = 0) -> tuple[list[dict], list[dict]]:
    ui, ha = [], []
    for e in c.luces:
        params = {"_off_after": off_after} if off_after else {}
        ui.append({"type": "device", "entity": e, "svc": svc, "params": params})
        ha.append({"service": svc, "target": {"entity_id": e}})
        if off_after and svc.endswith(".turn_on"):
            ha += [{"delay": {"minutes": off_after}}, {"service": svc.replace("turn_on", "turn_off"), "target": {"entity_id": e}}]
    return ui, ha


def _auto(name: str, icon: str, trig: tuple[dict, dict], acciones: tuple[list, list], conds: tuple[list, list] = ((), ())) -> dict[str, Any]:
    return _regla("auto", name, icon, _auto_ui([trig[0]], list(conds[0]), acciones[0]), [trig[1]], list(conds[1]), acciones[1])


_NOCHE = ([{"type": "sun", "when": "night"}], [{"condition": "state", "entity_id": "sun.sun", "state": "below_horizon"}])


# ---------------------------------------------------------------- catálogo
def _puerta_abierta(c: Ctx, p: dict[str, Any]) -> dict[str, Any]:
    e, m = c.ent("puerta"), p["minutos"]
    ui = {"ents": [e], "mins": {_mkey(e): m}, "default_min": m, "only_away": p["solo_sin_nadie"], "only_night": False,
          "recipients": [], "critical": False, "repeat_min": 30, "max_repeats": 5, "auto_fix": False, "auto_fix_min": 15,
          "notify_fixed": True, "items": [{"entity": e, "for_min": m}]}
    return _regla("watch", f"Aviso: {c.nombre} abierta", "mdi:door-open", ui)


def _puerta_luz(c: Ctx, p: dict[str, Any]) -> dict[str, Any]:
    return _auto(f"Luz al abrir {c.nombre}", "mdi:lightbulb-on", _t_estado(c.ent("puerta"), "on"),
                 _luces_accion(c, "light.turn_on", p["apagar_en"]), _NOCHE if p["solo_de_noche"] else ((), ()))


def _presencia(c: Ctx, p: dict[str, Any]) -> dict[str, Any]:
    e = c.ent("movimiento") or c.ent("presencia")
    clave = "motion" if c.ent("movimiento") else "presence"
    ui = {"only_sensor": False, "lights": list(c.luces), "motion": [], "doors": [], "presence": [], clave: [e],
          "when": "sun" if p["solo_de_noche"] else "always", "elev": 2, "lux": None, "lux_max": 30, "on_door": True,
          "day_pct": "", "night": False, "night_from": "23:00", "night_to": "06:30", "night_pct": 10,
          "timeout": p["apagar_en"], "door_timeout": 1, "seal_window": 30, "sealed_max": 60, "manual_block": -1, "warn_s": 20,
          "fan": None, "fan_delay": 2, "fan_after": 5, "humidity": None, "hum_max": 70}
    return _regla("room", f"Luz por presencia {c.area or ''}".strip(), "mdi:motion-sensor", ui)


def _boton(c: Ctx, p: dict[str, Any]) -> dict[str, Any]:
    e = c.ent("boton")
    pulsacion = p["pulsacion"]
    if e.startswith("event."):
        ui_t = {"type": "button", "entity": e, "event_type": pulsacion}
        tr = {"platform": "state", "entity_id": e, "not_from": ["unavailable", "unknown"], "not_to": ["unavailable", "unknown"], "id": "t0"}
        conds = ([], [{"condition": "or", "conditions": [{"condition": "not", "conditions": [{"condition": "trigger", "id": "t0"}]},
                                                        {"condition": "state", "entity_id": e, "attribute": "event_type", "state": pulsacion}]}])
        trig = (ui_t, tr)
    else:  # Zigbee2MQTT viejo: sensor «action» que cambia a single / double / hold
        trig, conds = _t_estado(e, pulsacion), ((), ())
    return _auto(f"{c.nombre}: {PULSACIONES.get(pulsacion, pulsacion)} prende/apaga luces", "mdi:gesture-tap-button", trig,
                 _luces_accion(c, "light.toggle"), conds)


def _consumo_alto(c: Ctx, p: dict[str, Any]) -> dict[str, Any]:
    return _auto(f"Aviso: consumo alto en {c.nombre}", "mdi:flash-alert", _t_numero(_power(c), "above", p["watts"], p["minutos"]),
                 _avisos(c, "Consumo alto", f"{c.nombre} está consumiendo más de {p['watts']:g} W."))


def _fin_ciclo(c: Ctx, p: dict[str, Any]) -> dict[str, Any]:
    return _auto(f"Aviso: terminó {c.nombre}", "mdi:washing-machine", _t_numero(_power(c), "below", p["watts"], p["minutos"]),
                 _avisos(c, "Terminó", f"Terminó el ciclo de {c.nombre}."))


def _temp_aviso(c: Ctx, p: dict[str, Any]) -> dict[str, Any]:
    d = "above" if p["cuando"] == "sube" else "below"
    word = "pasó los" if d == "above" else "bajó de"
    return _auto(f"Aviso: temperatura {c.area or c.nombre}", "mdi:thermometer-alert", _t_numero(c.ent("temperatura"), d, p["grados"]),
                 _avisos(c, "Temperatura", f"La temperatura en {c.area or c.nombre} {word} {p['grados']:g}°."))


def _humedad_aviso(c: Ctx, p: dict[str, Any]) -> dict[str, Any]:
    return _auto(f"Aviso: humedad {c.area or c.nombre}", "mdi:water-percent-alert", _t_numero(c.ent("humedad"), "above", p["porcentaje"]),
                 _avisos(c, "Humedad", f"La humedad en {c.area or c.nombre} pasó el {p['porcentaje']:g}%."))


def _aire(c: Ctx, p: dict[str, Any], prender: bool) -> dict[str, Any]:
    t = c.ent("temperatura")
    if prender:
        trig = _t_numero(t, "above", p["grados"], 5)
        ui = [{"type": "device", "entity": a, "svc": "climate.set_temperature", "params": {"temperature": p["objetivo"], "hvac_mode": "cool"}} for a in c.aires]
        ha = [{"service": "climate.set_temperature", "target": {"entity_id": a}, "data": {"temperature": p["objetivo"], "hvac_mode": "cool"}} for a in c.aires]
        return _auto(f"Prender el aire de {c.area} con calor", "mdi:air-conditioner", trig, (ui, ha))
    trig = _t_numero(t, "below", p["grados"], 10)
    ui = [{"type": "device", "entity": a, "svc": "climate.turn_off", "params": {}} for a in c.aires]
    ha = [{"service": "climate.turn_off", "target": {"entity_id": a}} for a in c.aires]
    return _auto(f"Apagar el aire de {c.area} cuando refresca", "mdi:air-conditioner", trig, (ui, ha))


def _alarma(funcion: str, titulo: str, icono: str) -> Callable[[Ctx, dict[str, Any]], dict[str, Any]]:
    def build(c: Ctx, p: dict[str, Any]) -> dict[str, Any]:
        return _auto(f"Aviso: {titulo.lower()} en {c.area or c.nombre}", icono, _t_estado(c.ent(funcion), "on"),
                     _avisos(c, titulo, f"{titulo} en {c.area or c.nombre}."))
    return build


def _power(c: Ctx) -> str | None:
    for eid in (c.info.get("entidades") or {}).get("medicion") or []:
        st = c.hass.states.get(eid)
        if st and (st.attributes.get("device_class") == "power" or st.attributes.get("unit_of_measurement") in ("W", "kW")):
            return eid
    reg = er.async_get(c.hass)
    for eid in (c.info.get("entidades") or {}).get("medicion") or []:
        e = reg.async_get(eid)
        if e and (e.device_class or e.original_device_class) == "power":
            return eid
    return None


PULSACIONES = {"single": "toque", "double": "doble toque", "hold": "mantener apretado", "long": "mantener apretado", "long_press": "mantener apretado"}


def _tiene(f: str) -> Callable[[Ctx], bool]:
    return lambda c: bool(c.ent(f))


PLANTILLAS: dict[str, Plantilla] = {p.id: p for p in (
    Plantilla("puerta_abierta_aviso", "Avisar si queda abierta", "Te avisa al celular si la puerta o ventana queda abierta un rato.",
              _tiene("puerta"), {"minutos": Param("entero", "Minutos abierta", 10, 1, 240),
                                 "solo_sin_nadie": Param("si_no", "Sólo si no hay nadie en casa", False)}, _puerta_abierta),
    Plantilla("puerta_luz_noche", "Prender la luz al abrir", "De noche, al abrir, prende las luces del ambiente y las apaga solas.",
              lambda c: bool(c.ent("puerta") and c.luces), {"apagar_en": Param("entero", "Apagar a los (minutos)", 3, 1, 60),
                                                            "solo_de_noche": Param("si_no", "Sólo de noche", True)}, _puerta_luz),
    Plantilla("presencia_luces", "Luces por presencia", "Prende las luces del ambiente cuando entra alguien y las apaga si no hay nadie.",
              lambda c: bool((c.ent("movimiento") or c.ent("presencia")) and c.luces),
              {"apagar_en": Param("entero", "Apagar sin nadie a los (minutos)", 5, 1, 120),
               "solo_de_noche": Param("si_no", "Sólo cuando oscurece", True)}, _presencia),
    Plantilla("boton_luces", "Botón para las luces", "Con el botón prendés y apagás las luces del ambiente.",
              lambda c: bool(c.ent("boton") and c.luces), {"pulsacion": Param("opcion", "Pulsación", "single", opciones=["single", "double", "hold"])}, _boton),
    Plantilla("consumo_alto", "Avisar consumo alto", "Te avisa si el enchufe consume más de lo normal un rato.",
              lambda c: bool(_power(c)), {"watts": Param("decimal", "Más de (W)", 2000, 10, 4000),
                                          "minutos": Param("entero", "Durante (minutos)", 5, 1, 120)}, _consumo_alto),
    Plantilla("fin_de_ciclo", "Avisar cuando termina (lavarropas)", "Te avisa cuando el lavarropas u otro equipo termina su ciclo.",
              lambda c: bool(_power(c)), {"watts": Param("decimal", "Menos de (W)", 5, 0.5, 100),
                                          "minutos": Param("entero", "Durante (minutos)", 3, 1, 30)}, _fin_ciclo),
    Plantilla("temperatura_aviso", "Avisar por temperatura", "Te avisa si la temperatura pasa un límite.",
              _tiene("temperatura"), {"cuando": Param("opcion", "Cuándo", "sube", opciones=["sube", "baja"]),
                                      "grados": Param("decimal", "Grados", 30, -20, 60)}, _temp_aviso),
    Plantilla("aire_prender", "Prender el aire con calor", "Si hace calor en el ambiente, prende el aire en frío.",
              lambda c: bool(c.ent("temperatura") and c.aires), {"grados": Param("decimal", "Cuando pasa los (°)", 27, 18, 40),
                                                                  "objetivo": Param("decimal", "Dejarlo en (°)", 24, 16, 30)},
              lambda c, p: _aire(c, p, True)),
    Plantilla("aire_apagar", "Apagar el aire cuando refresca", "Apaga el aire del ambiente cuando la temperatura baja.",
              lambda c: bool(c.ent("temperatura") and c.aires), {"grados": Param("decimal", "Cuando baja de (°)", 22, 10, 30)},
              lambda c, p: _aire(c, p, False)),
    Plantilla("humedad_aviso", "Avisar por humedad", "Te avisa si la humedad pasa un límite.",
              _tiene("humedad"), {"porcentaje": Param("decimal", "Más de (%)", 75, 30, 100)}, _humedad_aviso),
    Plantilla("agua_aviso", "Avisar pérdida de agua", "Te avisa apenas detecta agua.", _tiene("agua"), {}, _alarma("agua", "Pérdida de agua", "mdi:water-alert")),
    Plantilla("humo_aviso", "Avisar humo o gas", "Te avisa apenas detecta humo o gas.", _tiene("humo"), {}, _alarma("humo", "Humo o gas", "mdi:smoke-detector-alert")),
)}


# ---------------------------------------------------------------- uso
def _area_de(hass: HomeAssistant, device_id: str) -> tuple[str | None, str | None]:
    dev = dr.async_get(hass).async_get(device_id)
    area = ar.async_get(hass).async_get_area(dev.area_id) if dev and dev.area_id else None
    return (area.id, area.name) if area else (None, None)


def _en_area(hass: HomeAssistant, area_id: str | None, domain: str, sin: str) -> list[str]:
    if not area_id:
        return []
    ents, devs = er.async_get(hass), dr.async_get(hass)
    out = []
    for e in ents.entities.values():
        if e.domain != domain or e.device_id == sin or e.disabled_by or e.hidden_by or e.entity_category:
            continue
        aid = e.area_id or (devs.async_get(e.device_id).area_id if e.device_id and devs.async_get(e.device_id) else None)
        if aid == area_id:
            out.append(e.entity_id)
    return sorted(out)


def contexto(hass: HomeAssistant, info: dict[str, Any]) -> Ctx:
    from ..escenas.notify import app_targets  # noqa: PLC0415

    area_id, area = _area_de(hass, info["device_id"])
    return Ctx(hass, info, area_id, area, _en_area(hass, area_id, "light", info["device_id"]),
               _en_area(hass, area_id, "climate", info["device_id"]), [f"notify.{t}" for t in app_targets(hass)])


def _params(c: Ctx, p: Plantilla) -> dict[str, Param]:
    """Los parámetros de la plantilla para este equipo (un botón ofrece las pulsaciones que de verdad tiene)."""
    if p.id != "boton_luces":
        return p.params
    st = c.hass.states.get(c.ent("boton") or "")
    tipos = [str(x) for x in (st.attributes.get("event_types") or st.attributes.get("options") or []) if x] if st else []
    tipos = [t for t in tipos if t not in ("unknown", "unavailable", "")]
    if not tipos:
        return p.params
    return {"pulsacion": Param("opcion", "Pulsación", tipos[0], opciones=tipos)}


def sugerir(hass: HomeAssistant, info: dict[str, Any]) -> list[dict[str, Any]]:
    c = contexto(hass, info)
    out = []
    for p in PLANTILLAS.values():
        if p.aplica(c):
            out.append({"plantilla": p.id, "titulo": p.titulo, "descripcion": p.descripcion,
                        "parametros": {k: v.schema() for k, v in _params(c, p).items()}, "ya_existe": bool(_existente(hass, info["device_id"], p.id))})
    return out


def _existente(hass: HomeAssistant, device_id: str, plantilla: str) -> str | None:
    m = hass.data.get(ESCENAS)
    for rid, r in (getattr(m, "rules", None) or {}).items():
        tag = (r.get("ui") or {}).get("_alta") or {}
        if tag.get("device_id") == device_id and tag.get("plantilla") == plantilla:
            return rid
    return None


async def crear(hass: HomeAssistant, user, info: dict[str, Any], plantilla: str, parametros: dict[str, Any] | None) -> dict[str, Any]:
    p = PLANTILLAS.get(plantilla)
    if p is None:
        raise AltaError("Esa automatización no existe.")
    manager = hass.data.get(ESCENAS)
    if manager is None:
        raise AltaError("Las automatizaciones no están andando en esta casa.")
    c = contexto(hass, info)
    if not p.aplica(c):
        raise AltaError("Esa automatización no sirve para este equipo (o falta algo en el ambiente, como luces o aire).")
    if _existente(hass, info["device_id"], p.id):
        raise AltaError("Esa automatización ya está creada para este equipo.")
    params = _params(c, p)
    extra = set(parametros or {}) - set(params)
    if extra:
        raise AltaError(f"No conozco estos datos: {', '.join(sorted(extra))}.")
    vals = {k: v.validar((parametros or {}).get(k)) for k, v in params.items()}
    raw = p.construir(c, vals)
    raw["ui"]["_alta"] = {"device_id": info["device_id"], "plantilla": p.id}
    from ..escenas.manager import InvalidRule  # noqa: PLC0415

    try:
        rule = await manager.async_save(raw, user)
    except InvalidRule as err:
        raise AltaError(str(err)) from err
    return {"rule_id": rule["id"], "nombre": rule["name"], "parametros": vals}
