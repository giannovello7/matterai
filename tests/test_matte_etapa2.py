"""Matte, etapa 2: que conozca la casa.

- «Llegó Sofi en auto»: la cámara ve un auto y el celular de Sofi llega a casa (antes o después, dentro de la ventana).
  Un auto sin nadie que llegue → «Llegó un auto que no reconozco» (si se pidió). Por el celular nunca abre solo.
- Matte arma esa regla (Llegadas, con el modelo del panel) sólo con el «dale»; con abrir es delicada (app, dos veces).
- «Acomodemos la casa»: revisar_casa y propuestas de nombre y ambiente, que sólo aplica el titular o el instalador.
"""

from __future__ import annotations

from datetime import timedelta

import pytest

from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import entity_registry as er
from homeassistant.setup import async_setup_component
from homeassistant.util import dt as dt_util

from pytest_homeassistant_custom_component.common import MockConfigEntry, async_fire_time_changed

from custom_components.matterai.asistente.reglas import ReglaError, compile_rule
from custom_components.matterai.const import DOMAIN
from custom_components.matterai.escenas.const import DOMAIN as ESC

from .test_matte_asistente import FakeAI, _txt, _ultimo, _use

DATA = {"name": "Casa Pérez", "url": "https://perez.matterai.com.ar", "support_phone": "5491100000000", "central_key": "", "central_url": "https://panel.matterai.com.ar"}


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    yield


async def _casa(hass, monkeypatch=None):
    await async_setup_component(hass, "http", {})
    hass.states.async_set("person.sofi", "not_home", {"friendly_name": "Sofi"})
    hass.states.async_set("person.tomi", "not_home", {"friendly_name": "Tomi"})
    hass.states.async_set("light.living", "off", {"friendly_name": "Luz living"})
    entry = MockConfigEntry(domain=DOMAIN, data=DATA, title="MatterAI · Casa Pérez")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    a = hass.data[DOMAIN]["asistente"]
    fake = FakeAI()
    if monkeypatch is not None:
        monkeypatch.setattr(a, "_api_key_fn", lambda: "clave-de-prueba")

        async def _cliente(_key):
            return fake

        monkeypatch.setattr(a, "_cliente", _cliente)
    return a, fake, hass.data[ESC]


def _car(eid="1700000000.1-abc", camera="entrada", **kw):
    return {"id": eid, "camera": camera, "label": "car", "entered_zones": [], "current_zones": [], **kw}


async def _regla_llegadas(hass, manager, **ui):
    admin = await hass.auth.async_create_user("Inst", group_ids=["system-admin"])
    raw = compile_rule({"kind": "fface", "name": "Llegadas", "ui": {"phones": True, "cameras": ["entrada"], **ui}})
    rule = await manager.async_save(raw, admin)
    await hass.async_block_till_done()
    return manager.runners[rule["id"]].room


async def test_llego_sofi_en_auto(hass) -> None:
    _, _, manager = await _casa(hass)
    ctl = await _regla_llegadas(hass, manager)
    sent = []

    async def _send(title, msg, **kw):
        sent.append((title, msg, kw))

    ctl.notifier.send = _send
    # el auto primero, el celular después (dentro de la ventana)
    ctl.on_frigate("new", _car())
    hass.states.async_set("person.sofi", "home", {"friendly_name": "Sofi"})
    await hass.async_block_till_done()
    assert sent and "Llegó Sofi en auto" in sent[0][1] and sent[0][2]["image"].endswith("1700000000.1-abc/snapshot.jpg")
    assert ctl.history[0]["kind"] == "phone" and ctl.history[0]["who"] == "Sofi"
    # el celular primero (llegaron dos), el auto después: un solo aviso con los dos
    hass.states.async_set("person.tomi", "home", {"friendly_name": "Tomi"})
    await hass.async_block_till_done()
    ctl._cooldown.clear()  # noqa: SLF001
    hass.states.async_set("person.sofi", "not_home", {"friendly_name": "Sofi"})
    hass.states.async_set("person.sofi", "home", {"friendly_name": "Sofi"})
    await hass.async_block_till_done()
    ctl.on_frigate("new", _car("1700000001.2-def"))
    await hass.async_block_till_done()
    assert "Tomi y Sofi en auto" in sent[-1][1]
    # NEGATIVO: un auto estacionado (stationary) o un falso positivo no cuenta
    n = len(sent)
    ctl.on_frigate("new", _car("x1", stationary=True))
    ctl.on_frigate("new", _car("x2", false_positive=True))
    ctl.on_frigate("new", _car("x3", camera="vereda"))  # otra cámara
    assert not ctl._cars and len(sent) == n  # noqa: SLF001


async def test_auto_que_no_reconozco_y_nunca_abre_solo(hass) -> None:
    _, _, manager = await _casa(hass)
    opened = []
    hass.states.async_set("cover.porton", "closed", {"device_class": "gate"})

    async def _open(call):
        opened.append(call)

    hass.services.async_register("cover", "open_cover", _open)
    admin = await hass.auth.async_create_user("Inst", group_ids=["system-admin"])
    rule = await manager.async_save({**compile_rule({"kind": "fface", "name": "Llegadas", "ui": {"phones": True, "unknown_cars": True}}),
                                     "ui": {**compile_rule({"kind": "fface", "name": "x", "ui": {"phones": True, "unknown_cars": True}})["ui"], "unlock": "cover.porton", "unlock_mode": "auto"}}, admin)
    await hass.async_block_till_done()
    ctl = manager.runners[rule["id"]].room
    sent = []

    async def _send(title, msg, **kw):
        sent.append((title, msg, kw))

    ctl.notifier.send = _send
    ctl.on_frigate("new", _car(sub_label=None))
    async_fire_time_changed(hass, dt_util.utcnow() + timedelta(minutes=4))
    await hass.async_block_till_done()
    assert sent and "auto que no reconozco" in sent[0][1] and sent[0][2]["image"]
    # con «abrir solo» (lo puede elegir el instalador para caras): por el celular sólo ofrece el botón
    ctl.on_frigate("new", _car("1700000002.3-ghi"))
    hass.states.async_set("person.sofi", "home", {"friendly_name": "Sofi"})
    await hass.async_block_till_done()
    assert "Sofi en auto" in sent[-1][1] and sent[-1][2]["actions"] and not opened


def test_matte_no_arma_aperturas_automaticas() -> None:
    with pytest.raises(ReglaError, match="aperturas automáticas"):
        compile_rule({"kind": "fface", "name": "x", "ui": {"phones": True, "unlock": "cover.porton", "unlock_mode": "auto"}})
    with pytest.raises(ReglaError):
        compile_rule({"kind": "fface", "name": "x", "ui": {}})  # sin quién
    r = compile_rule({"kind": "fface", "name": "Llegadas", "ui": {"phones": True, "inventado": 1}})
    assert "inventado" not in r["ui"] and r["ui"]["message"] == "Llegó {nombre}" and r["ui"]["window_min"] == 3


async def test_matte_propone_llegadas_y_con_abrir_es_delicada(hass, monkeypatch) -> None:
    a, fake, manager = await _casa(hass, monkeypatch)
    user = await hass.auth.async_create_user("Gian")
    regla = {"kind": "fface", "name": "Llegadas en auto", "ui": {"phones": True, "cameras": ["entrada"], "unknown_cars": True}}
    fake.steps = [[_use("proponer", {"accion": "crear", "titulo": "Llegadas en auto", "explicacion": "Te aviso quién llega en auto.", "regla": regla})], [_txt("¿Dale?")]]
    out = await a.conversar(user, "avisame cuando llegue alguien en auto", None, "app")
    assert not out["propuestas"][0]["sensible"]
    assert (await a.confirmar(user, out["session_id"], out["propuestas"][0]["id"], True))["ok"]
    rule = next(r for r in manager.rules.values() if r["name"] == "Llegadas en auto")
    assert rule["ui"]["phones"] and rule["ui"]["unknown_cars"] and rule["ui"]["unlock_mode"] == "ask"
    # cambiar: «que también abra el portón con un botón» → conserva lo demás y pasa a delicada
    fake.steps = [[_use("proponer", {"accion": "cambiar", "rule_id": rule["id"], "titulo": "Llegadas en auto", "explicacion": "Suma el botón para abrir.",
                                     "regla": {"ui": {"unlock": "cover.porton"}}})], [_txt("¿Dale?")]]
    out2 = await a.conversar(user, "que me ofrezca abrir el portón", out["session_id"], "app")
    p = out2["propuestas"][0]
    assert p["sensible"]
    assert (await a.confirmar(user, out["session_id"], p["id"], True))["necesita_segunda"]
    assert (await a.confirmar(user, out["session_id"], p["id"], True, segura=True))["ok"]
    assert manager.rules[rule["id"]]["ui"]["unlock"] == "cover.porton" and manager.rules[rule["id"]]["ui"]["phones"]


async def test_acomodar_la_casa_nombres_y_ambientes(hass, monkeypatch) -> None:
    a, fake, _ = await _casa(hass, monkeypatch)
    reg = er.async_get(hass)
    ent = reg.async_get_or_create("light", "test", "lv1", suggested_object_id="lamp_0x12ab")
    hass.states.async_set(ent.entity_id, "off", {"friendly_name": "Light 0x12ab"})
    living = ar.async_get(hass).async_get_or_create("Living")
    inst = await hass.auth.async_create_user("Inst", group_ids=["system-admin"])
    cliente = await hass.auth.async_create_user("Visita")
    # revisar_casa ve el nombre feo, el equipo sin ambiente y las personas sin celular
    fake.steps = [[_use("revisar_casa")], lambda m: [_txt(str(_ultimo(m)[0]))]]
    out = await a.conversar(inst, "acomodemos la casa", None, "app")
    assert "Light 0x12ab" in out["say"] and "sin ambiente" in out["say"] and "Sin celular vinculado: Sofi, Tomi" in out["say"]
    # renombrar y ambiente: propuesta → «dale» → hecho
    fake.steps = [[_use("proponer", {"accion": "renombrar", "entity_id": ent.entity_id, "nuevo_nombre": "Lámpara del living", "titulo": "Nombre", "explicacion": "x"}),
                   _use("proponer", {"accion": "ambiente", "entity_id": ent.entity_id, "area_id": living.id, "titulo": "Ambiente", "explicacion": "x"})], [_txt("¿Dale?")]]
    out = await a.conversar(inst, "ponele lámpara del living", out["session_id"], "app")
    for p in out["propuestas"]:
        assert (await a.confirmar(inst, out["session_id"], p["id"], True))["ok"]
    e = reg.async_get(ent.entity_id)
    assert e.name == "Lámpara del living" and e.area_id == living.id
    # NEGATIVO: alguien que no es el titular ni el instalador no puede (ni un parlante sin usuario)
    fake.steps = [[_use("proponer", {"accion": "renombrar", "entity_id": ent.entity_id, "nuevo_nombre": "Otra", "titulo": "x", "explicacion": "x"})], lambda m: [_txt(_ultimo(m)[0]["error"])]]
    out = await a.conversar(cliente, "renombrala", None, "app")
    assert "titular" in out["say"] and not out["propuestas"]
    fake.steps = [[_use("proponer", {"accion": "renombrar", "entity_id": ent.entity_id, "nuevo_nombre": "Otra", "titulo": "x", "explicacion": "x"})], lambda m: [_txt(_ultimo(m)[0]["error"])]]
    out = await a.conversar(None, "renombrala", None, "voz")
    assert "titular" in out["say"] and reg.async_get(ent.entity_id).name == "Lámpara del living"


async def test_historial_sin_registro_avisa(hass, monkeypatch) -> None:
    a, fake, _ = await _casa(hass, monkeypatch)
    fake.steps = [[_use("historial", {"entity_id": "person.sofi"}), _use("historial", {"entity_id": "light.inventada"})], lambda m: [_txt(str(_ultimo(m)))]]
    out = await a.conversar(None, "¿a qué hora llegó Sofi?", None, "voz")
    assert "no guarda historial" in out["say"] and "No encuentro ese equipo" in out["say"]
