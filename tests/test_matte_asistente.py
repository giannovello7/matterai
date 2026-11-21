"""Matte, la IA de la casa (etapa 1): conversa, recuerda y arma automatizaciones SÓLO con el «dale».

La IA está simulada (un guion). Lo que se prueba es lo que hace cumplir el código, no el prompt:
- una propuesta no se aplica en el mismo turno en que se hizo; sí con los botones o en el turno siguiente;
- lo que toca cerraduras, alarma o portones sólo se aplica desde la app y con doble confirmación;
- un parlante sin usuario nunca arma con permisos de administrador;
- la memoria no guarda claves y cada persona borra sólo lo suyo (y lo de la casa);
- las reglas quedan con el modelo del panel (se pueden editar ahí) y compiladas igual que en el panel;
- si la IA falla, la conversación queda como estaba.
"""

from __future__ import annotations

import json

import pytest

from homeassistant.components import conversation
from homeassistant.core import Context
from homeassistant.setup import async_setup_component

from pytest_homeassistant_custom_component.common import MockConfigEntry, async_mock_service

from custom_components.matterai.asistente.reglas import ReglaError, compile_rule
from custom_components.matterai.const import DOMAIN
from custom_components.matterai.escenas.const import DOMAIN as ESC

DATA = {"name": "Casa Pérez", "url": "https://perez.matterai.com.ar", "support_phone": "5491100000000", "central_key": "", "central_url": "https://panel.matterai.com.ar"}


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    yield


# ---------------------------------------------------------------- reglas con el modelo del panel
def test_compila_igual_que_el_panel() -> None:
    r = compile_rule({"kind": "auto", "name": "Siesta de Tomi", "ui": {
        "triggers": [{"type": "time", "at": "14:00", "days": ["mon", "tue", "wed", "thu", "fri"]}],
        "conditions": [{"type": "presence", "who": "anyone"}],
        "actions": [{"type": "device", "entity": "cover.cuarto_tomi", "svc": "cover.close_cover"},
                    {"type": "device", "entity": "light.pasillo", "svc": "light.turn_on", "params": {"brightness_pct": 20, "_off_after": 30}}],
    }})
    assert r["triggers"] == [{"platform": "time", "at": "14:00:00", "id": "t0"}]
    assert r["conditions"][0]["conditions"][1] == {"condition": "time", "weekday": ["mon", "tue", "wed", "thu", "fri"]}
    assert r["conditions"][1] == {"condition": "numeric_state", "entity_id": "zone.home", "above": 0}
    assert r["actions"] == [
        {"service": "cover.close_cover", "target": {"entity_id": "cover.cuarto_tomi"}},
        {"service": "light.turn_on", "target": {"entity_id": "light.pasillo"}, "data": {"brightness_pct": 20}},
        {"delay": {"minutes": 30}}, {"service": "light.turn_off", "target": {"entity_id": "light.pasillo"}},
    ]
    assert r["ui"]["cond_mode"] == "all" and r["icon"] == "mdi:creation"  # el panel la abre como cualquier otra
    p = compile_rule({"kind": "period", "name": "Luces del jardín", "ui": {"entities": ["light.jardin"], "on": {"type": "sunset", "offset": 15}, "off": {"type": "time", "at": "00:30"}}})
    assert p["triggers"] == [{"platform": "sun", "event": "sunset", "offset": "00:15:00", "id": "on"}, {"platform": "time", "at": "00:30:00", "id": "off"}]
    rem = compile_rule({"kind": "reminder", "name": "Pastilla", "ui": {"text": "Tomar la pastilla", "time": "09:00", "repeat": "daily"}})
    assert rem["ui"]["repeat"] == "daily" and rem["ui"]["recipients"] == [] and rem["actions"] == []
    # NEGATIVOS: tipos que Matte no arma, hora mal, servicio de otro dominio, sin acciones
    for bad in (
        {"kind": "gate", "name": "x", "ui": {}},
        {"kind": "auto", "name": "x", "ui": {"triggers": [{"type": "time", "at": "25:00"}], "actions": [{"type": "scene", "entity": "scene.a"}]}},
        {"kind": "scene", "name": "x", "ui": {"actions": [{"type": "device", "entity": "light.a", "svc": "lock.unlock"}]}},
        {"kind": "auto", "name": "x", "ui": {"triggers": [{"type": "time", "at": "10:00"}], "actions": []}},
        {"kind": "reminder", "name": "x", "ui": {"text": "", "time": "10:00"}},
        {"kind": "auto", "name": "", "ui": {}},
    ):
        with pytest.raises(ReglaError):
            compile_rule(bad)


# ---------------------------------------------------------------- IA simulada
class _Resp:
    def __init__(self, blocks):
        self.content = blocks
        self.stop_reason = "tool_use" if any(b["type"] == "tool_use" for b in blocks) else "end_turn"


_N = [0]


def _use(name, args=None):
    _N[0] += 1
    return {"type": "tool_use", "id": f"tu_{_N[0]}", "name": name, "input": args or {}}


def _txt(t):
    return {"type": "text", "text": t}


def _ultimo(messages):
    for m in reversed(messages):
        if m["role"] == "user" and isinstance(m["content"], list):
            return [json.loads(c["content"]) for c in m["content"]]
    return []


class FakeAI:
    def __init__(self):
        self.steps, self.calls = [], []
        self.messages = self

    async def create(self, **kw):
        self.calls.append(kw)
        step = self.steps.pop(0)
        out = step(kw["messages"]) if callable(step) else step
        if isinstance(out, Exception):
            raise out
        return _Resp(out)


async def _casa(hass, monkeypatch):
    await async_setup_component(hass, "http", {})
    for eid, st, attrs in [
        ("light.living", "on", {"friendly_name": "Luz living"}), ("cover.cortina_tomi", "open", {"friendly_name": "Cortina Tomi"}),
        ("lock.puerta", "locked", {"friendly_name": "Puerta"}), ("cover.porton", "closed", {"friendly_name": "Portón", "device_class": "gate"}),
        ("binary_sensor.mov_living", "on", {"friendly_name": "Movimiento living", "device_class": "motion"}),
        ("binary_sensor.puerta_patio", "on", {"friendly_name": "Puerta patio", "device_class": "door"}),
        ("person.sofi", "home", {"friendly_name": "Sofi"}),
    ]:
        hass.states.async_set(eid, st, attrs)
    entry = MockConfigEntry(domain=DOMAIN, data=DATA, title="MatterAI · Casa Pérez")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    await hass.data[DOMAIN]["dashboard"].async_save({"rooms": [
        {"name": "Living", "entities": ["light.living"]},
        {"name": "Cuarto de Tomi", "entities": ["cover.cortina_tomi"]},
        {"name": "Entrada", "entities": ["lock.puerta", "cover.porton"]},
    ]})
    a = hass.data[DOMAIN]["asistente"]
    fake = FakeAI()
    monkeypatch.setattr(a, "_api_key_fn", lambda: "clave-de-prueba")

    async def _cliente(_key):
        return fake

    monkeypatch.setattr(a, "_cliente", _cliente)
    return a, fake, hass.data[ESC]


SIESTA = {"kind": "auto", "name": "Siesta de Tomi", "ui": {"triggers": [{"type": "time", "at": "14:00"}],
          "actions": [{"type": "device", "entity": "cover.cortina_tomi", "svc": "cover.close_cover"}]}}


async def test_propone_y_aplica_solo_con_el_dale(hass, monkeypatch) -> None:
    a, fake, manager = await _casa(hass, monkeypatch)
    user = await hass.auth.async_create_user("Gian")
    # turno 1: propone y (mal) intenta aplicar en el mismo turno → el código lo frena
    fake.steps = [
        [_txt("Pensando…"), _use("proponer", {"accion": "crear", "titulo": "Siesta de Tomi", "explicacion": "A las 14 baja la cortina de Tomi.", "regla": SIESTA})],
        lambda m: [_use("aplicar", {"propuesta_id": _ultimo(m)[0]["propuesta_id"]})],
        lambda m: (_ultimo(m)[0]["ok"] is False and "esperá" in _ultimo(m)[0]["error"]) and [_txt("¿Te la armo?")],
    ]
    out = await a.conversar(user, "Tomi duerme la siesta de 14 a 16", None, "app")
    assert out["ok"] and out["say"].endswith("¿Te la armo?") and out["pregunta"]
    assert [p["titulo"] for p in out["propuestas"]] == ["Siesta de Tomi"] and not out["propuestas"][0]["sensible"]
    assert not [r for r in manager.rules.values() if r["name"] == "Siesta de Tomi"]
    pid = out["propuestas"][0]["id"]
    # la cabecera dice quién habla y la hora; la memoria va aparte del catálogo (que queda en caché)
    first = fake.calls[0]
    assert first["messages"][0]["content"].startswith("[") and "habla Gian" in first["messages"][0]["content"]
    assert first["system"][1]["cache_control"] == {"type": "ephemeral"} and "light.living" in first["system"][1]["text"]
    # turno 2: «sí» → ahora sí
    fake.steps = [[_use("aplicar", {"propuesta_id": pid})], lambda m: _ultimo(m)[0]["ok"] and [_txt("Listo.")]]
    out2 = await a.conversar(user, "sí, dale", out["session_id"], "app")
    assert out2["ok"]
    rule = next(r for r in manager.rules.values() if r["name"] == "Siesta de Tomi")
    assert rule["kind"] == "auto" and rule["triggers"] == [{"platform": "time", "at": "14:00:00", "id": "t0"}]
    assert rule["ui"]["triggers"][0]["at"] == "14:00" and rule["created_by"] == "Gian"
    # cambiar «la de la siesta a las 15»: misma regla (mismo id), otra hora
    fake.steps = [
        [_use("proponer", {"accion": "cambiar", "rule_id": rule["id"], "titulo": "Siesta de Tomi", "explicacion": "Pasa a las 15.",
                           "regla": {"ui": {**SIESTA["ui"], "triggers": [{"type": "time", "at": "15:00"}]}}})],
        [_txt("La paso a las 15, ¿dale?")],
    ]
    out3 = await a.conversar(user, "cambiá la de la siesta a las 15", out["session_id"], "app")
    res = await a.confirmar(user, out["session_id"], out3["propuestas"][0]["id"], True)
    assert res["ok"] and manager.rules[rule["id"]]["triggers"][0]["at"] == "15:00:00"
    assert len([r for r in manager.rules.values() if r["name"] == "Siesta de Tomi"]) == 1


async def test_lo_delicado_se_confirma_dos_veces_en_la_app(hass, monkeypatch) -> None:
    a, fake, manager = await _casa(hass, monkeypatch)
    user = await hass.auth.async_create_user("Gian")
    regla = {"kind": "auto", "name": "Cerrar al irse", "ui": {"triggers": [{"type": "presence", "who": "last"}],
             "actions": [{"type": "device", "entity": "lock.puerta", "svc": "lock.lock"}]}}
    fake.steps = [[_use("proponer", {"accion": "crear", "titulo": "Cerrar al irse", "explicacion": "Cuando se va el último, cierra la puerta.", "regla": regla})], [_txt("¿Dale?")]]
    out = await a.conversar(user, "que se cierre la puerta cuando nos vamos", None, "voz")
    p = out["propuestas"][0]
    assert p["sensible"]
    # por voz, en el turno siguiente: NO
    fake.steps = [[_use("aplicar", {"propuesta_id": p["id"]})], lambda m: "app" in _ultimo(m)[0]["error"] and [_txt("Eso confirmalo en la app.")]]
    await a.conversar(user, "sí", out["session_id"], "voz")
    assert not [r for r in manager.rules.values() if r["name"] == "Cerrar al irse"]
    # en la app: el primer «Sí» pide otra confirmación; el segundo, sí
    first = await a.confirmar(user, out["session_id"], p["id"], True)
    assert not first["ok"] and first["necesita_segunda"]
    second = await a.confirmar(user, out["session_id"], p["id"], True, segura=True)
    assert second["ok"] and [r for r in manager.rules.values() if r["name"] == "Cerrar al irse"]
    # NEGATIVO: otra persona no puede confirmar la propuesta de otro
    otro = await hass.auth.async_create_user("Visita")
    assert not (await a.confirmar(otro, out["session_id"], p["id"], True, segura=True))["ok"]


async def test_no_maneja_cerraduras_ni_portones_y_dice_quien_esta(hass, monkeypatch) -> None:
    a, fake, _ = await _casa(hass, monkeypatch)
    off = async_mock_service(hass, "light", "turn_off")
    unlock = async_mock_service(hass, "lock", "unlock")
    opened = async_mock_service(hass, "cover", "open_cover")
    fake.steps = [
        [_use("controlar", {"acciones": [{"servicio": "lock.unlock", "entity_ids": ["lock.puerta"]}, {"servicio": "cover.open_cover", "entity_ids": ["cover.porton"]},
                                         {"servicio": "light.turn_off", "entity_ids": ["light.living"]}]}), _use("quien_esta")],
        lambda m: [_txt(json.dumps(_ultimo(m)))],
    ]
    out = await a.conversar(None, "abrí la puerta y apagá el living, ¿hay alguien?", None, "voz")
    await hass.async_block_till_done()
    assert [c.data["entity_id"] for c in off] == [["light.living"]] and not unlock and not opened
    res = json.loads(out["say"])
    assert len(res[0]["descartadas"]) == 2
    quien = res[1]
    assert quien["personas"][0]["persona"] == "Sofi" and quien["personas"][0]["donde"] == "en casa"
    assert quien["movimiento_ultima_hora"][0]["sensor"] == "Movimiento living" and quien["abiertas"][0]["sensor"] == "Puerta patio"


async def test_parlante_sin_usuario_no_es_administrador(hass, monkeypatch) -> None:
    a, fake, manager = await _casa(hass, monkeypatch)
    manager.set_settings({"client_off": ["period"]})
    regla = {"kind": "period", "name": "Jardín", "ui": {"entities": ["light.living"], "on": {"type": "time", "at": "20:00"}, "off": {"type": "time", "at": "23:00"}}}
    fake.steps = [[_use("proponer", {"accion": "crear", "titulo": "Jardín", "explicacion": "x", "regla": regla})], lambda m: [_txt(_ultimo(m)[0]["error"])]]
    out = await a.conversar(None, "prendé el jardín de 20 a 23 todos los días", None, "voz")
    assert "no habilitó" in out["say"] and not out["propuestas"]


async def test_memoria_por_persona_sin_claves(hass, monkeypatch) -> None:
    a, fake, _ = await _casa(hass, monkeypatch)
    gian = await hass.auth.async_create_user("Gian")
    sofi = await hass.auth.async_create_user("Sofi")
    fake.steps = [
        [_use("recordar", {"texto": "Tomi duerme la siesta de 14 a 16", "de_la_casa": True}), _use("recordar", {"texto": "Le gusta el aire en 23", "de_la_casa": False}),
         _use("recordar", {"texto": "La contraseña del wifi es 1234", "de_la_casa": True})],
        lambda m: [_txt("Me lo anoto.")],
    ]
    await a.conversar(gian, "Tomi duerme la siesta de 14 a 16, a mí me gusta el aire en 23 y la contraseña del wifi es 1234", None, "app")
    mg, ms = a.memoria.de(gian.id), a.memoria.de(sofi.id)
    assert [x["texto"] for x in mg["casa"]] == ["Tomi duerme la siesta de 14 a 16"]
    assert [x["texto"] for x in mg["mia"]] == ["Le gusta el aire en 23"]
    assert ms["mia"] == [] and ms["casa"] == mg["casa"]  # lo de Gian no lo ve Sofi; lo de la casa, sí
    assert "contraseña" not in json.dumps(a.memoria.data)
    # la memoria llega al modelo en el mensaje siguiente, aparte del catálogo
    fake.steps = [[_txt("ok")]]
    await a.conversar(gian, "hola", None, "app")
    assert "Le gusta el aire en 23" in fake.calls[-1]["system"][2]["text"]
    # Sofi no puede borrar lo de Gian; Gian sí
    gid = mg["mia"][0]["id"]
    assert not a.memoria.borrar(sofi.id, gid)
    assert a.memoria.borrar(gian.id, gid) and a.memoria.de(gian.id)["mia"] == []


async def test_no_insiste_y_si_falla_la_ia_no_queda_a_medias(hass, monkeypatch) -> None:
    a, fake, _ = await _casa(hass, monkeypatch)
    user = await hass.auth.async_create_user("Gian")
    fake.steps = [[_use("proponer", {"accion": "crear", "titulo": "Siesta de Tomi", "explicacion": "x", "regla": SIESTA})], [_txt("¿Dale?")]]
    out = await a.conversar(user, "siesta", None, "app")
    assert (await a.confirmar(user, out["session_id"], out["propuestas"][0]["id"], False))["ok"]
    assert a.memoria.rechazos(user.id) == ["Siesta de Tomi"]
    s = a.sesiones[out["session_id"]]
    n = len(s["messages"])
    fake.steps = [RuntimeError("se cortó")]
    bad = await a.conversar(user, "y algo más", out["session_id"], "app")
    assert not bad["ok"] and len(s["messages"]) == n
    # lo que tocó en los botones llega en el próximo mensaje, y el rechazo queda en la memoria del modelo
    fake.steps = [[_txt("ok")]]
    await a.conversar(user, "hola", out["session_id"], "app")
    assert "tocó «No»" in fake.calls[-1]["messages"][-1]["content"] or "tocó «No»" in json.dumps(fake.calls[-1]["messages"], ensure_ascii=False)
    assert "Siesta de Tomi" in fake.calls[-1]["system"][2]["text"]


async def test_sin_clave_avisa(hass, monkeypatch) -> None:
    a, _, _ = await _casa(hass, monkeypatch)
    monkeypatch.setattr(a, "_api_key_fn", lambda: None)
    out = await a.conversar(None, "hola", None, "voz")
    assert not out["ok"] and out["sin_ia"]


async def test_es_el_asistente_de_home_assistant(hass, monkeypatch) -> None:
    assert await async_setup_component(hass, "homeassistant", {})
    assert await async_setup_component(hass, "conversation", {})
    a, fake, _ = await _casa(hass, monkeypatch)
    fake.steps = [[_txt("¡Hola! Acá estoy.")], [_txt("Sigo acá.")]]
    r = await conversation.async_converse(hass, "hola Matte", None, Context(), language="es", agent_id="conversation.matte")
    assert r.response.speech["plain"]["speech"] == "¡Hola! Acá estoy."
    r2 = await conversation.async_converse(hass, "¿seguís?", r.conversation_id, Context(), language="es", agent_id="conversation.matte")
    assert r2.conversation_id == r.conversation_id and len(a.sesiones[r.conversation_id]["messages"]) == 4


async def test_la_voz_de_la_app_sigue_con_matte(hass, monkeypatch) -> None:
    """Lo que el modo gratis no entiende va a Matte; con una charla abierta (session_id), todo va a Matte."""
    a, fake, _ = await _casa(hass, monkeypatch)
    rt = hass.data[DOMAIN]
    brain = rt["voice"]
    monkeypatch.setattr(brain, "api_key", "clave-de-prueba")
    user = await hass.auth.async_create_user("Gian")
    fake.steps = [[_txt("Te cuento un chiste: …")]]
    out = await brain.async_handle("contame un chiste", rt["dashboard"].config, Context(user_id=user.id))
    assert out["source"] == "matte" and out["session_id"] and "chiste" in out["say"]
    fake.steps = [[_txt("Otro más…")]]
    out2 = await brain.async_handle("otro", rt["dashboard"].config, Context(user_id=user.id), out["session_id"])
    assert out2["session_id"] == out["session_id"] and len(a.sesiones[out["session_id"]]["messages"]) == 4
