"""La rutina de la casa: qué se usa más y qué se repite a la misma hora (para sugerir escenas y automatizaciones).

Todo sale del historial que ya guarda Home Assistant (recorder), en la casa. Nada de esto viaja a ningún lado salvo
el resumen que Matte usa para conversar.

- usados: los equipos que más se prendieron / apagaron (para el dashboard «Lo que más usás»).
- patrones: lo que pasa casi todos los días a la misma hora (± 20 min): «apagás la luz del living a las 23:35».
- grupos: patrones juntos a la misma hora → una escena o automatización con varios equipos.
- llegadas / salidas: a qué hora suele llegar o irse cada persona.
- ya_automatizado: lo que ya hace una regla con horario (no se vuelve a sugerir).
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from statistics import median
from typing import Any

WEEK = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
CONTROL = ("light", "switch", "fan", "cover", "climate", "media_player", "input_boolean", "scene", "script")
VENTANA = 40  # minutos: dos cambios entran en el mismo patrón si están dentro de esta ventana
JUNTOS = 20  # minutos: patrones que se agrupan en una misma sugerencia


def _target(domain: str, state: str) -> str | None:
    """A qué «lado» fue el cambio: on / off (y para persianas, open / closed)."""
    if domain == "cover":
        return "open" if state == "open" else "closed" if state == "closed" else None
    if domain == "climate":
        return "off" if state == "off" else "on" if state not in ("unavailable", "unknown") else None
    if domain == "media_player":
        return "on" if state == "playing" else "off" if state in ("off", "paused", "idle", "standby") else None
    if domain in ("scene", "script"):
        return "on" if state not in ("unavailable", "unknown") else None
    if domain == "person":
        return "home" if state == "home" else "away" if state == "not_home" else None
    return state if state in ("on", "off") else None


def _hhmm(m: float) -> str:
    m = int(round(m)) % 1440
    return f"{m // 60:02d}:{m % 60:02d}"


def _dias_texto(days: list[str]) -> str:
    if len(days) >= 6:
        return "todos los días"
    if set(days) <= set(WEEK[:5]) and len(days) >= 4:
        return "de lunes a viernes"
    if set(days) == {"sat", "sun"}:
        return "los fines de semana"
    nombres = {"mon": "lunes", "tue": "martes", "wed": "miércoles", "thu": "jueves", "fri": "viernes", "sat": "sábados", "sun": "domingos"}
    return ", ".join(nombres[d] for d in days)


def patrones_de(eventos: list[datetime], dias_con_datos: int) -> list[dict[str, Any]]:
    """Cambios a la misma hora en distintos días. eventos: horas locales de un mismo equipo hacia un mismo lado."""
    if not eventos or dias_con_datos < 4:
        return []
    # lo que pasa antes de las 4 de la mañana es de la noche anterior (apagar todo a las 00:10 es «del martes»)
    noche = [(e, e - timedelta(hours=4)) for e in eventos]
    pts = sorted(((e.hour * 60 + e.minute, d.date(), WEEK[d.weekday()]) for e, d in noche), key=lambda x: x[0])
    out: list[dict[str, Any]] = []
    usados: set[int] = set()
    for _ in range(3):  # hasta 3 horarios por equipo
        mejor: list[int] = []
        inicio = 0
        for i in range(len(pts)):
            if i in usados:
                continue
            idx = [j for j in range(len(pts)) if j not in usados and 0 <= (pts[j][0] - pts[i][0]) % 1440 <= VENTANA]
            dias = {pts[j][1] for j in idx}
            if len(dias) > len({pts[j][1] for j in mejor}):
                mejor, inicio = idx, pts[i][0]
        dias = {pts[j][1] for j in mejor}
        minimo = max(4, int(dias_con_datos * 0.5 + 0.999))
        if len(dias) < minimo:
            break
        usados.update(mejor)
        # un cambio por día (el primero de la ventana) para la hora típica
        por_dia: dict[Any, int] = {}
        for j in mejor:
            por_dia.setdefault(pts[j][1], pts[j][0])
        base = inicio  # el principio de la ventana (si cruza la medianoche, 23:55 y 00:05 quedan juntos)
        mins = [base + ((m - base) % 1440) for m in por_dia.values()]
        semana = sorted({pts[j][2] for j in mejor}, key=WEEK.index)
        out.append({"hora": _hhmm(median(mins)), "dias": semana, "dias_texto": _dias_texto(semana),
                    "veces": len(dias), "de_dias": dias_con_datos, "constancia": round(len(dias) / dias_con_datos, 2)})
    return out


def analizar(historial: dict[str, list[tuple[datetime, str]]], nombres: dict[str, str], dias: int,
             reglas_con_horario: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    """historial: entity_id → [(hora local, estado nuevo)], en orden. Devuelve lo que Matte usa para sugerir."""
    usados: dict[str, int] = defaultdict(int)
    patrones: list[dict[str, Any]] = []
    personas: list[dict[str, Any]] = []
    todos_los_dias = {(t - timedelta(hours=4)).date() for cambios in historial.values() for t, _ in cambios}
    dias_con_datos = min(dias, len(todos_los_dias))
    for eid, cambios in historial.items():
        domain = eid.split(".")[0]
        lados: dict[str, list[datetime]] = defaultdict(list)
        prev = None
        for t, st in cambios:
            lado = _target(domain, st)
            if lado is None:
                continue
            if lado != prev or domain in ("scene", "script"):
                lados[lado].append(t)
                if domain != "person":
                    usados[eid] += 1
            prev = lado
        for lado, ev in lados.items():
            if domain in ("scene", "script") and lado != "on":
                continue
            for p in patrones_de(ev, dias_con_datos):
                item = {"entity_id": eid, "nombre": nombres.get(eid, eid), "lado": lado, **p}
                (personas if domain == "person" else patrones).append(item)
    # lo que ya hace una regla con horario (± JUNTOS min) no se sugiere de nuevo
    hechos = []
    for p in patrones:
        pm = int(p["hora"][:2]) * 60 + int(p["hora"][3:])
        for r in reglas_con_horario or []:
            rm = int(r["hora"][:2]) * 60 + int(r["hora"][3:5])
            if p["entity_id"] in r["equipos"] and min((pm - rm) % 1440, (rm - pm) % 1440) <= JUNTOS:
                p["ya_automatizado"] = r["nombre"]
                hechos.append(p)
                break
    libres = sorted((p for p in patrones if "ya_automatizado" not in p), key=lambda p: (p["hora"], p["lado"]))
    # agrupar: mismo lado, hora parecida y días parecidos → una sola sugerencia
    grupos: list[dict[str, Any]] = []
    for p in libres:
        pm = int(p["hora"][:2]) * 60 + int(p["hora"][3:])
        g = next((g for g in grupos if g["lado"] == p["lado"] and min((pm - g["_m"]) % 1440, (g["_m"] - pm) % 1440) <= JUNTOS
                  and g["dias_texto"] == p["dias_texto"]), None)
        if g is None:
            grupos.append({"_m": pm, "hora": p["hora"], "lado": p["lado"], "dias": p["dias"], "dias_texto": p["dias_texto"], "equipos": [], "constancia": p["constancia"]})
            g = grupos[-1]
        g["equipos"].append({"entity_id": p["entity_id"], "nombre": p["nombre"]})
        g["constancia"] = min(g["constancia"], p["constancia"])
    for g in grupos:
        g.pop("_m")
        verbo = {"on": "prendés", "off": "apagás", "open": "abrís", "closed": "cerrás"}.get(g["lado"], g["lado"])
        g["frase"] = f"{g['dias_texto'].capitalize()} a eso de las {g['hora']} {verbo} {', '.join(e['nombre'] for e in g['equipos'])}"
    top = sorted(usados.items(), key=lambda x: -x[1])[:10]
    return {
        "dias_estudiados": dias_con_datos,
        "usados": [{"entity_id": e, "nombre": nombres.get(e, e), "veces": n} for e, n in top],
        "sugerencias": sorted(grupos, key=lambda g: (-len(g["equipos"]), -g["constancia"]))[:8],
        "ya_automatizado": [{"nombre": p["nombre"], "hora": p["hora"], "regla": p["ya_automatizado"]} for p in hechos][:10],
        "personas": personas[:12],
        "nota": "Con menos de 4 días de historial todavía no se ven costumbres." if dias_con_datos < 4 else "",
    }


async def estudiar(hass, dias: int, entidades: list[str], nombres: dict[str, str], reglas_con_horario: list[dict[str, Any]]) -> dict[str, Any]:
    """Lee el historial de la casa (en un hilo aparte: puede ser mucho) y lo analiza."""
    from homeassistant.components.recorder import get_instance, history  # noqa: PLC0415
    from homeassistant.util import dt as dt_util  # noqa: PLC0415

    start = dt_util.utcnow() - timedelta(days=dias)

    def _q():
        out: dict[str, list[tuple[datetime, str]]] = {}
        for eid in entidades:
            res = history.state_changes_during_period(hass, start, entity_id=eid, include_start_time_state=False, no_attributes=True)
            out[eid] = [(dt_util.as_local(s.last_changed), s.state) for s in res.get(eid, [])]
        return out

    hist = await get_instance(hass).async_add_executor_job(_q)
    return analizar(hist, nombres, dias, reglas_con_horario)
