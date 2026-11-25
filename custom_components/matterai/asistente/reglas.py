"""Automatizaciones que arma Matte, con el mismo modelo («ui») que el panel de Automatizaciones.

El panel compila ese modelo a disparadores/condiciones/acciones de Home Assistant en el navegador
(matterai-escenas-card.js → compileRule). Acá está la misma compilación para los tipos que usa Matte
(escena, automatización, horario y recordatorio): así lo que crea Matte se abre y se edita en el panel
como cualquier otra, y el motor (manager.async_save) valida y aplica los permisos de siempre.
"""

from __future__ import annotations

import re
from typing import Any

ESCENAS_DOMAIN = "matterai_escenas"
KINDS_MATTE = ("scene", "auto", "period", "reminder", "fface")
ICONS = {"scene": "mdi:gesture-tap", "auto": "mdi:creation", "period": "mdi:clock-time-eight-outline", "reminder": "mdi:bell-ring-outline",
         "fface": "mdi:face-recognition"}
# «Llegadas» (Caras y patentes conocidas): los mismos valores por defecto que el panel (newDraft → fface)
FFACE_BASE = {
    "any_known": False, "people": [], "plates": [], "cameras": [], "zones": [], "when": "always", "from": "07:00", "to": "23:00", "cooldown_min": 30,
    "notify": True, "recipients": [], "message": "Llegó {nombre}", "silent": False, "unlock": None, "unlock_mode": "ask", "unlock_name": "Abrir", "code": "",
    "disarm": False, "alarm": None, "lights": [], "lights_dark": True, "speakers": [], "tts": None, "welcome": "Bienvenido, {nombre}", "rules_run": [],
    "foto": True, "phones": False, "phone_people": [], "unknown_cars": False, "window_min": 3,
}
ALL_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
AREA_SVC = {"on": "turn_on", "off": "turn_off", "open": "open_cover", "close": "close_cover", "pause": "media_pause"}
_HM = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
_ENT = re.compile(r"^[a-z_]+\.[a-z0-9_]+$")


class ReglaError(ValueError):
    """Algo del modelo de la regla no tiene sentido (el texto se le cuenta a Matte para que lo corrija)."""


def _hm(v: Any, what: str) -> str:
    s = str(v or "")
    if not _HM.match(s):
        raise ReglaError(f"{what}: la hora va como HH:MM (24 h)")
    return s


def _ent(v: Any, what: str) -> str:
    s = str(v or "")
    if not _ENT.match(s):
        raise ReglaError(f"{what}: falta el equipo (entity_id)")
    return s


def _days(v: Any) -> list[str]:
    days = [d for d in (v or []) if d in ALL_DAYS]
    return days


def _all_days(days: list[str] | None) -> bool:
    return not days or len(days) == 0 or len(days) == 7


def _offset(minutes: Any) -> str:
    m = int(round(float(minutes or 0)))
    a = abs(m)
    return f"{'-' if m < 0 else ''}{a // 60:02d}:{a % 60:02d}:00"


def _weekday_cond(days: list[str]) -> dict[str, Any]:
    return {"condition": "time", "weekday": days}


def _num(v: Any, what: str) -> float:
    try:
        return float(v)
    except (TypeError, ValueError) as err:
        raise ReglaError(f"{what}: falta el número") from err


# ------------------------------------------------------------------ compilar (igual que el panel)
def compile_trigger(t: dict[str, Any], tid: str) -> tuple[dict[str, Any], dict[str, Any] | None]:
    typ = t.get("type")
    if typ == "device":
        ent = _ent(t.get("entity"), "Disparador")
        if t.get("dir") in ("above", "below"):
            tr: dict[str, Any] = {"platform": "numeric_state", "entity_id": ent, t["dir"]: _num(t.get("value"), "Disparador")}
            if t.get("for_min"):
                tr["for"] = {"minutes": int(t["for_min"])}
            return {**tr, "id": tid}, None
        tr = {"platform": "state", "entity_id": ent, "not_from": ["unavailable", "unknown"]}
        if t.get("to"):
            tr["to"] = str(t["to"])
        else:
            tr["not_to"] = ["unavailable", "unknown"]
        if t.get("for_min") and t.get("to"):
            tr["for"] = {"minutes": int(t["for_min"])}
        return {**tr, "id": tid}, None
    if typ == "time":
        days = _days(t.get("days"))
        return {"platform": "time", "at": f"{_hm(t.get('at'), 'Disparador')}:00", "id": tid}, (None if _all_days(days) else _weekday_cond(days))
    if typ == "sun":
        if t.get("event") not in ("sunrise", "sunset"):
            raise ReglaError("Disparador del sol: amanecer (sunrise) o atardecer (sunset)")
        days = _days(t.get("days"))
        return {"platform": "sun", "event": t["event"], "offset": _offset(t.get("offset")), "id": tid}, (None if _all_days(days) else _weekday_cond(days))
    if typ == "presence":
        who = t.get("who")
        if who == "first":
            return {"platform": "numeric_state", "entity_id": "zone.home", "above": 0, "id": tid}, None
        if who == "last":
            return {"platform": "numeric_state", "entity_id": "zone.home", "below": 1, "id": tid}, None
        who = _ent(who, "Disparador de presencia")
        if not t.get("zone") or t.get("zone") == "zone.home":
            return {"platform": "state", "entity_id": who, **({"from": "home"} if t.get("event") == "leave" else {"to": "home"}), "id": tid}, None
        return {"platform": "zone", "entity_id": who, "zone": _ent(t["zone"], "Zona"), "event": "leave" if t.get("event") == "leave" else "enter", "id": tid}, None
    if typ == "interval":
        every = max(1, int(_num(t.get("every"), "Cada cuánto")))
        tr = {"platform": "time_pattern", "hours": f"/{every}", "minutes": 0} if t.get("unit") == "h" else {"platform": "time_pattern", "minutes": f"/{every}"}
        return {**tr, "id": tid}, None
    raise ReglaError(f"Disparador desconocido: {typ}")


def compile_cond(c: dict[str, Any]) -> dict[str, Any]:
    typ = c.get("type")
    if typ == "time":
        o: dict[str, Any] = {"condition": "time"}
        if not c.get("allday"):
            o["after"] = f"{_hm(c.get('after'), 'Condición')}:00"
            o["before"] = f"{_hm(c.get('before'), 'Condición')}:00"
        days = _days(c.get("days"))
        if not _all_days(days):
            o["weekday"] = days
        return o
    if typ == "sun":
        return {"condition": "state", "entity_id": "sun.sun", "state": "above_horizon" if c.get("when") == "day" else "below_horizon"}
    if typ == "device":
        ent = _ent(c.get("entity"), "Condición")
        if c.get("dir") in ("above", "below"):
            return {"condition": "numeric_state", "entity_id": ent, c["dir"]: _num(c.get("value"), "Condición")}
        return {"condition": "state", "entity_id": ent, "state": str(c.get("state") or "")}
    if typ == "presence":
        who = c.get("who")
        if who == "anyone":
            return {"condition": "numeric_state", "entity_id": "zone.home", "above": 0}
        if who == "nobody":
            return {"condition": "state", "entity_id": "zone.home", "state": "0"}
        who = _ent(who, "Condición de presencia")
        if c.get("where") == "away":
            return {"condition": "not", "conditions": [{"condition": "state", "entity_id": who, "state": "home"}]}
        return {"condition": "state", "entity_id": who, "state": "home"}
    raise ReglaError(f"Condición desconocida: {typ}")


def compile_action(a: dict[str, Any]) -> list[dict[str, Any]]:
    typ = a.get("type")
    if typ == "device":
        ent = _ent(a.get("entity"), "Acción")
        svc = str(a.get("svc") or "")
        if "." not in svc or svc.split(".")[0] != ent.split(".")[0]:
            raise ReglaError(f"Acción sobre {ent}: el servicio tiene que ser del mismo tipo (por ejemplo light.turn_on)")
        data = {k: v for k, v in (a.get("params") or {}).items() if not str(k).startswith("_") and v not in (None, "")}
        if "volume_level" in data:
            data["volume_level"] = float(data["volume_level"]) / 100
        out: list[dict[str, Any]] = [{"service": svc, "target": {"entity_id": ent}, **({"data": data} if data else {})}]
        off = int(float((a.get("params") or {}).get("_off_after") or 0))
        if off > 0 and svc.endswith(".turn_on"):
            out += [{"delay": {"minutes": off}}, {"service": svc[: -len("turn_on")] + "turn_off", "target": {"entity_id": ent}}]
        return out
    if typ == "area":
        if a.get("op") not in AREA_SVC:
            raise ReglaError("Acción por ambiente: on, off, open, close o pause")
        dom = str(a.get("domain") or "")
        if dom not in ("light", "switch", "cover", "media_player", "fan", "climate"):
            raise ReglaError("Acción por ambiente: tipo de equipo inválido")
        target = {"entity_id": "all"} if a.get("area") == "all" else {"area_id": str(a.get("area") or "")}
        return [{"service": f"{dom}.{AREA_SVC[a['op']]}", "target": target}]
    if typ == "scene":
        ent = _ent(a.get("entity"), "Escena")
        return [{"service": "script.turn_on" if ent.startswith("script.") else "scene.turn_on", "target": {"entity_id": ent}}]
    if typ == "rule":
        rid = str(a.get("rule_id") or "")
        if not rid:
            raise ReglaError("Falta la automatización a usar")
        if a.get("op") == "run":
            return [{"service": f"{ESCENAS_DOMAIN}.run", "data": {"rule_id": rid}}]
        return [{"service": f"{ESCENAS_DOMAIN}.set_enabled", "data": {"rule_id": rid, "enabled": a.get("op") == "enable"}}]
    if typ == "notify":
        target = str(a.get("target") or "")
        if not target or not re.match(r"^[a-z0-9_]+$", target):
            raise ReglaError("Aviso: falta a qué celular (notify)")
        foto = str(a.get("foto") or "")
        if foto and foto != "no" and not re.match(r"^camera\.[a-z0-9_]+$", foto):
            raise ReglaError("Aviso: foto va como el id de una cámara (camera.x), «no» (sin foto) o sin poner nada (automática)")
        return [{"service": f"notify.{target}", "data": {"message": str(a.get("message") or ""), **({"title": str(a["title"])} if a.get("title") else {}),
                                                         **({"data": {"foto": foto}} if foto else {})}}]
    if typ == "delay":
        return [{"delay": {"hours": int(a.get("h") or 0), "minutes": int(a.get("m") or 0), "seconds": int(a.get("s") or 0)}}]
    raise ReglaError(f"Acción desconocida: {typ}")


def compile_rule(d: dict[str, Any]) -> dict[str, Any]:
    """Del modelo del panel a la regla que guarda el motor (lo mismo que compileRule de la tarjeta)."""
    kind = d.get("kind")
    if kind not in KINDS_MATTE:
        raise ReglaError(f"Matte arma escenas, automatizaciones, horarios y recordatorios (no «{kind}»)")
    u = d.get("ui") if isinstance(d.get("ui"), dict) else {}
    out: dict[str, Any] = {
        "name": str(d.get("name") or "").strip()[:80], "icon": d.get("icon") or ICONS[kind], "color": d.get("color") or "#4F8EF7",
        "kind": kind, "enabled": d.get("enabled", True) is not False, "mode": d.get("mode") or "restart",
        "ui": u, "triggers": [], "conditions": [], "actions": [], "on_stop": [],
    }
    if d.get("id"):
        out["id"] = str(d["id"])
    if not out["name"]:
        raise ReglaError("Ponele un nombre corto y claro")
    if kind in ("scene", "auto"):
        u.setdefault("triggers", [])
        u.setdefault("conditions", [])
        u.setdefault("cond_mode", "all")
        u.setdefault("actions", [])
        if not u["actions"]:
            raise ReglaError("Falta qué hace (acciones)")
        out["actions"] = [x for a in u["actions"] for x in compile_action(a)]
        if kind == "auto":
            if not u["triggers"]:
                raise ReglaError("Falta cuándo se activa (disparadores)")
            tc: list[dict[str, Any]] = []
            for i, t in enumerate(u["triggers"]):
                tr, cond = compile_trigger(t, f"t{i}")
                out["triggers"].append(tr)
                if cond:
                    tc.append({"condition": "or", "conditions": [{"condition": "not", "conditions": [{"condition": "trigger", "id": f"t{i}"}]}, cond]})
            uc = [compile_cond(c) for c in u["conditions"]]
            out["conditions"] = [*tc, *([{"condition": "or", "conditions": uc}] if u.get("cond_mode") == "any" and len(uc) > 1 else uc)]
    elif kind == "period":
        ents = [_ent(e, "Horario") for e in u.get("entities") or []]
        if not ents:
            raise ReglaError("Horario: faltan los equipos")
        u["entities"] = ents

        def mom(m: dict[str, Any], tid: str) -> dict[str, Any]:
            m = m if isinstance(m, dict) else {}
            if m.get("type", "time") == "time":
                return {"platform": "time", "at": f"{_hm(m.get('at'), 'Horario')}:00", "id": tid}
            if m.get("type") not in ("sunrise", "sunset"):
                raise ReglaError("Horario: hora fija, amanecer o atardecer")
            return {"platform": "sun", "event": m["type"], "offset": _offset(m.get("offset")), "id": tid}

        u.setdefault("days", list(ALL_DAYS))
        out["triggers"] = [mom(u.get("on") or {}, "on"), mom(u.get("off") or {}, "off")]
        if not _all_days(_days(u["days"])):
            out["conditions"] = [_weekday_cond(_days(u["days"]))]
        turn = lambda svc: {"service": f"homeassistant.{svc}", "target": {"entity_id": ents}}  # noqa: E731
        out["actions"] = [{"choose": [
            {"conditions": [{"condition": "trigger", "id": "on"}], "sequence": [turn("turn_on")]},
            {"conditions": [{"condition": "trigger", "id": "off"}], "sequence": [turn("turn_off")]},
        ]}]
    elif kind == "fface":
        u = {**FFACE_BASE, **{k: v for k, v in u.items() if k in FFACE_BASE}}
        if u.get("unlock_mode") == "auto":
            raise ReglaError("Matte no arma aperturas automáticas: el portón o la puerta se abren con el botón del aviso")
        for key in ("people", "plates", "cameras", "zones", "phone_people", "lights", "speakers", "recipients", "rules_run"):
            if not isinstance(u.get(key), list):
                raise ReglaError(f"Llegadas: {key} va como lista")
        if not (u["phones"] or u["any_known"] or u["people"] or u["plates"]):
            raise ReglaError("Llegadas: elegí por el celular (phones), caras (people), patentes (plates) o cualquier conocido")
        out["ui"] = u
    elif kind == "reminder":
        base = {"text": "", "date": "", "time": "", "repeat": "none", "days": [], "recipients": [], "critical": False, "nag_min": 0}
        u = {**base, **u}
        if not str(u["text"]).strip():
            raise ReglaError("Recordatorio: falta qué hay que recordar")
        _hm(u.get("time"), "Recordatorio")
        if u["repeat"] not in ("none", "daily", "weekly", "monthly", "yearly"):
            raise ReglaError("Recordatorio: repetición none, daily, weekly, monthly o yearly")
        if u.get("date") and not re.match(r"^\d{4}-\d{2}-\d{2}$", str(u["date"])):
            raise ReglaError("Recordatorio: la fecha va como AAAA-MM-DD")
        u["days"] = _days(u.get("days"))
        out["ui"] = u
    return out


# ------------------------------------------------------------------ lo delicado
SENSIBLES = {"lock", "alarm_control_panel"}


def es_sensible(hass, rule: dict[str, Any]) -> bool:
    """Cerraduras, alarma y portones: se confirman dos veces y sólo en la app (nunca por voz)."""
    def walk(node: Any):
        if isinstance(node, dict):
            yield node
            for v in node.values():
                yield from walk(v)
        elif isinstance(node, list):
            for v in node:
                yield from walk(v)

    ui = rule.get("ui") if isinstance(rule.get("ui"), dict) else {}
    if rule.get("kind") == "fface" and (ui.get("unlock") or ui.get("disarm")):
        return True
    for n in walk([rule.get("actions"), ui.get("actions")]):
        svc = n.get("service") or n.get("svc") or n.get("action")
        ents = (n.get("target") or {}).get("entity_id") if isinstance(n.get("target"), dict) else n.get("entity")
        ents = ents if isinstance(ents, list) else [ents] if isinstance(ents, str) else []
        if isinstance(svc, str) and svc.split(".")[0] in SENSIBLES:
            return True
        for e in ents:
            if e.split(".")[0] in SENSIBLES:
                return True
            st = hass.states.get(e)
            if st is not None and st.domain == "cover" and st.attributes.get("device_class") in ("garage", "gate"):
                return True
    return False
