"""Matte, etapa 3: la rutina de la casa → sugerencias, un inicio con lo que más usás y las ideas de la semana.

- El análisis encuentra lo que se repite casi todos los días a la misma hora (y lo agrupa), lo más usado y las
  llegadas; no sugiere lo que ya hace una regla con horario ni lo que pasa pocas veces.
- El inicio nuevo («Lo que más usás») se arma sólo con el «dale», no pisa el del instalador y valida con el esquema.
- Las ideas de la semana se avisan una sola vez cada una.
"""

from __future__ import annotations

from datetime import datetime, timedelta

import pytest

from custom_components.matterai.asistente.rutina import analizar, patrones_de
from custom_components.matterai.const import DOMAIN

from .test_matte_asistente import _casa, _txt, _use


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    yield


def _dias(n=14, h=23, m=30, jitter=(0, 4, -3, 6, 1, -5, 2), weekdays=None, skip=()):
    base = datetime(2026, 11, 2)  # lunes
    out = []
    for d in range(n):
        day = base + timedelta(days=d)
        if d in skip or (weekdays is not None and day.weekday() not in weekdays):
            continue
        out.append(day.replace(hour=h, minute=m) + timedelta(minutes=jitter[d % len(jitter)]))
    return out


def test_patrones_y_grupos() -> None:
    living_off = [(t, "off") for t in _dias()]
    living_on = [(t - timedelta(hours=4), "on") for t in _dias(skip=(3, 9))]
    cocina_off = [(t + timedelta(minutes=4), "off") for t in _dias(skip=(5,))]
    tele = [(t, "playing") for t in _dias(n=14, h=21, m=0, skip=tuple(range(0, 14, 2)))]  # día por medio: no alcanza
    sofi = [(t, "home") for t in _dias(h=19, m=10, weekdays={0, 1, 2, 3, 4})]
    hist = {"light.living": sorted(living_off + living_on), "light.cocina": [(t - timedelta(hours=3), "on") for t, _ in cocina_off] + cocina_off,
            "media_player.tele": tele, "person.sofi": [(t - timedelta(hours=10), "not_home") for t, _ in sofi] + sofi}
    for k in hist:
        hist[k].sort()
    nombres = {"light.living": "Luz living", "light.cocina": "Luz cocina", "media_player.tele": "Tele", "person.sofi": "Sofi"}
    r = analizar(hist, nombres, 14)
    assert r["dias_estudiados"] == 14
    noche = next(g for g in r["sugerencias"] if g["lado"] == "off")
    assert {e["entity_id"] for e in noche["equipos"]} == {"light.living", "light.cocina"}
    assert noche["dias_texto"] == "todos los días" and noche["hora"].startswith("23:3")
    assert "apagás Luz living, Luz cocina" in noche["frase"] or "apagás Luz cocina, Luz living" in noche["frase"]
    assert not any(e["entity_id"] == "media_player.tele" for g in r["sugerencias"] for e in g["equipos"])  # pocas veces
    assert r["usados"][0]["entity_id"] in ("light.living", "light.cocina")
    llega = next(p for p in r["personas"] if p["lado"] == "home")
    assert llega["dias_texto"] == "de lunes a viernes" and llega["hora"].startswith("19:")
    # lo que ya hace una regla a esa hora no se vuelve a sugerir
    r2 = analizar(hist, nombres, 14, [{"nombre": "Buenas noches", "hora": "23:30", "equipos": ["light.cocina"]}])
    noche2 = next(g for g in r2["sugerencias"] if g["lado"] == "off")
    assert [e["entity_id"] for e in noche2["equipos"]] == ["light.living"]
    assert r2["ya_automatizado"][0]["regla"] == "Buenas noches"


def test_pocos_dias_no_inventa() -> None:
    assert patrones_de(_dias(n=3), 3) == []
    r = analizar({"light.living": [(t, "off") for t in _dias(n=3)]}, {}, 14)
    assert r["sugerencias"] == [] and "4 días" in r["nota"]
    # medianoche: 23:55 y 00:05 son la misma costumbre
    cruz = [t.replace(hour=23, minute=55) if i % 2 else (t + timedelta(days=1)).replace(hour=0, minute=5) for i, t in enumerate(_dias(n=10))]
    p = patrones_de(cruz, 10)
    assert p and p[0]["veces"] >= 8 and p[0]["hora"] in ("23:55", "23:56", "23:57", "23:58", "23:59", "00:00", "00:01", "00:02", "00:03", "00:04", "00:05")


async def test_inicio_con_lo_que_mas_usas(hass, monkeypatch) -> None:
    a, fake, _ = await _casa(hass, monkeypatch)
    v = hass.data[DOMAIN]["views"]
    general = v.put({"name": "General", "kind": "phone", "blocks": [{"id": "saludo", "type": "text", "cfg": {"text": "Hola"}}, {"id": "amb", "type": "rooms", "cfg": {"auto": True}}]})
    v.default = general["id"]
    user = await hass.auth.async_create_user("Gian")
    fake.steps = [[_use("proponer", {"accion": "dashboard", "titulo": "Tu inicio", "explicacion": "Arriba lo que más usás.", "equipos": ["light.living", "cover.cortina_tomi", "light.inventada"]})], [_txt("¿Dale?")]]
    out = await a.conversar(user, "armame un inicio con lo que más uso", None, "app")
    p = out["propuestas"][0]
    assert p["accion"] == "dashboard" and not v.users.get(user.id)  # todavía nada
    res = await a.confirmar(user, out["session_id"], p["id"], True)
    assert res["ok"], res
    mine = v.views[v.users[user.id]]
    assert mine["id"] != general["id"] and mine["name"] == "Inicio de Gian"
    assert [b["id"] for b in mine["blocks"]] == ["saludo", "matte-usados", "amb"]
    assert [i["entity"] for i in mine["blocks"][1]["cfg"]["items"]] == ["light.living", "cover.cortina_tomi"]  # sin inventados
    assert v.views[general["id"]]["blocks"][1]["id"] == "amb"  # el general no se tocó
    # otra vez: actualiza SU inicio (no crea otro) y no duplica la tarjeta
    fake.steps = [[_use("proponer", {"accion": "dashboard", "titulo": "Tu inicio", "explicacion": "x", "equipos": ["cover.cortina_tomi", "light.living"]})], [_txt("¿Dale?")]]
    out = await a.conversar(user, "cambiá lo que más uso", out["session_id"], "app")
    assert (await a.confirmar(user, out["session_id"], out["propuestas"][0]["id"], True))["ok"]
    mine2 = v.views[v.users[user.id]]
    assert mine2["id"] == mine["id"] and [b["id"] for b in mine2["blocks"]].count("matte-usados") == 1
    # NEGATIVO: por un parlante (sin usuario) no se arma
    fake.steps = [[_use("proponer", {"accion": "dashboard", "titulo": "x", "explicacion": "x", "equipos": ["cover.cortina_tomi", "light.living"]})], lambda m: [_txt("no")]]
    out = await a.conversar(None, "armame un inicio", None, "voz")
    assert not out["propuestas"]


async def test_ideas_de_la_semana_una_vez(hass, monkeypatch) -> None:
    a, _, _ = await _casa(hass, monkeypatch)
    idea = {"frase": "Todos los días a eso de las 23:30 apagás Luz living", "constancia": 0.9, "equipos": [], "hora": "23:30", "lado": "off"}

    async def _rutina(_dias=14):
        return {"sugerencias": [idea, {**idea, "frase": "Poco constante", "constancia": 0.4}]}

    monkeypatch.setattr(a, "rutina", _rutina)
    assert (await a.ideas_de_la_semana())["frase"] == idea["frase"]
    assert await a.ideas_de_la_semana() is None  # ya se avisó
    # lo que rechazó no se avisa
    a.memoria.data["ideas_avisadas"] = []
    a.memoria.rechazar(None, idea["frase"])
    assert await a.ideas_de_la_semana() is None
