"""Alta de dispositivos, fase 3: automatizaciones sugeridas desde plantillas y creadas sólo con confirmación.

Las reglas se guardan en el motor de automatizaciones de MatterAI (las mismas que se ven, editan y borran en la app).
Con pruebas negativas: parámetros fuera de rango o inventados, plantillas que no aplican, duplicados, un cliente sin
permiso y Matte intentando crear una automatización que el cliente no confirmó.
"""

from __future__ import annotations

import pytest

from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er

from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.matterai.alta.herramientas import ejecutar

from .test_alta_matte import _con_ia, _txt, _use
from .test_alta_zigbee import _admin, _casa, rapido  # noqa: F401
from .test_seguridad import _link, _pair, decode

ESC = "matterai_escenas"


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    yield


def _equipo(hass, ident, area, entities):
    """entities: (dominio, objeto, device_class, estado, atributos)."""
    src = MockConfigEntry(domain="demo_x", title=ident)
    src.add_to_hass(hass)
    dev = dr.async_get(hass).async_get_or_create(config_entry_id=src.entry_id, identifiers={("demo_x", ident)}, name=ident)
    if area:
        dr.async_get(hass).async_update_device(dev.id, area_id=ar.async_get(hass).async_get_or_create(area).id)
    for dom, obj, dc, st, attrs in entities:
        e = er.async_get(hass).async_get_or_create(dom, "demo_x", f"{ident}-{obj}", suggested_object_id=obj, device_id=dev.id,
                                                   config_entry=src, original_device_class=dc)
        hass.states.async_set(e.entity_id, st, {**({"device_class": dc} if dc else {}), **(attrs or {})})
    return dev.id


async def _cocina(hass, monkeypatch):
    await _casa(hass, None, monkeypatch)
    puerta = _equipo(hass, "puerta", "Cocina", [("binary_sensor", "puerta_cocina", "door", "off", {})])
    _equipo(hass, "luz", "Cocina", [("light", "luz_cocina", None, "off", {"supported_color_modes": ["brightness"]})])
    await hass.async_block_till_done()
    return puerta


async def test_sugerir_y_crear_aviso_puerta(hass, monkeypatch) -> None:
    puerta = await _cocina(hass, monkeypatch)
    user = await _admin(hass)
    out = await ejecutar(hass, user, "sugerir_automatizaciones", {"device_id": puerta})
    ids = [p["plantilla"] for p in out["plantillas"]]
    assert ids == ["puerta_abierta_aviso", "puerta_luz_noche"], ids
    assert out["plantillas"][0]["parametros"]["minutos"] == {"tipo": "entero", "texto": "Minutos abierta", "default": 10, "min": 1, "max": 240}
    r = await ejecutar(hass, user, "crear_automatizacion", {"device_id": puerta, "plantilla": "puerta_abierta_aviso", "parametros": {"minutos": 15}})
    assert r["ok"] and r["parametros"] == {"minutos": 15, "solo_sin_nadie": False}
    rule = hass.data[ESC].rules[r["rule_id"]]
    assert rule["kind"] == "watch" and rule["ui"]["items"] == [{"entity": "binary_sensor.puerta_cocina", "for_min": 15}]
    assert rule["ui"]["ents"] == ["binary_sensor.puerta_cocina"] and rule["ui"]["mins"] == {"binary_sensor__puerta_cocina": 15}, "se edita en la app"
    assert r["rule_id"] in hass.data[ESC].runners, "quedó andando"
    assert any(e["what"] == "automatización creada" for e in hass.data["matterai"]["audit"].entries)
    # NEGATIVO: duplicada, fuera de rango, datos inventados, plantilla inventada
    dup = await ejecutar(hass, user, "crear_automatizacion", {"device_id": puerta, "plantilla": "puerta_abierta_aviso"})
    assert not dup["ok"] and "ya está creada" in dup["error"]
    assert (await ejecutar(hass, user, "sugerir_automatizaciones", {"device_id": puerta}))["plantillas"][0]["ya_existe"]
    bad = await ejecutar(hass, user, "crear_automatizacion", {"device_id": puerta, "plantilla": "puerta_luz_noche", "parametros": {"apagar_en": 999}})
    assert not bad["ok"] and "va de 1 a 60" in bad["error"]
    bad = await ejecutar(hass, user, "crear_automatizacion", {"device_id": puerta, "plantilla": "puerta_luz_noche", "parametros": {"servicio": "lock.unlock"}})
    assert not bad["ok"] and "servicio" in bad["error"]
    assert not (await ejecutar(hass, user, "crear_automatizacion", {"device_id": puerta, "plantilla": "abrir_todo"}))["ok"]
    assert not (await ejecutar(hass, user, "crear_automatizacion", {"device_id": puerta, "plantilla": "presencia_luces"}))["ok"], "no aplica a una puerta"
    # luz al abrir, de noche: regla «si → entonces» con el mismo modelo que la tarjeta
    r = await ejecutar(hass, user, "crear_automatizacion", {"device_id": puerta, "plantilla": "puerta_luz_noche"})
    rule = hass.data[ESC].rules[r["rule_id"]]
    assert rule["kind"] == "auto" and rule["triggers"][0]["to"] == "on"
    assert rule["conditions"] == [{"condition": "state", "entity_id": "sun.sun", "state": "below_horizon"}]
    assert rule["actions"][0] == {"service": "light.turn_on", "target": {"entity_id": "light.luz_cocina"}} and rule["actions"][1] == {"delay": {"minutes": 3}}
    assert rule["ui"]["actions"][0]["params"] == {"_off_after": 3} and rule["ui"]["conditions"] == [{"type": "sun", "when": "night"}]
    # se borra como cualquier otra
    await hass.data[ESC].async_delete(r["rule_id"], user)
    assert r["rule_id"] not in hass.data[ESC].rules


async def test_enchufe_temperatura_y_boton(hass, monkeypatch) -> None:
    await _casa(hass, None, monkeypatch)
    user = await _admin(hass)
    enchufe = _equipo(hass, "enchufe", "Lavadero", [("switch", "lavarropas", None, "on", {}),
                                                     ("sensor", "lavarropas_potencia", "power", "350", {"unit_of_measurement": "W"})])
    _equipo(hass, "aire", "Dormitorio", [("climate", "aire_dormitorio", None, "off", {})])
    termo = _equipo(hass, "termo", "Dormitorio", [("sensor", "temp_dormitorio", "temperature", "25", {}), ("sensor", "hum_dormitorio", "humidity", "50", {})])
    _equipo(hass, "luz2", "Living", [("light", "living", None, "off", {})])
    boton = _equipo(hass, "boton", "Living", [("event", "boton_living", None, "unknown", {"event_types": ["single", "double"]})])
    await hass.async_block_till_done()
    ids = [p["plantilla"] for p in (await ejecutar(hass, user, "sugerir_automatizaciones", {"device_id": enchufe}))["plantillas"]]
    assert ids == ["consumo_alto", "fin_de_ciclo"]
    r = await ejecutar(hass, user, "crear_automatizacion", {"device_id": enchufe, "plantilla": "fin_de_ciclo", "parametros": {"watts": 3}})
    rule = hass.data[ESC].rules[r["rule_id"]]
    assert rule["triggers"][0] == {"platform": "numeric_state", "entity_id": "sensor.lavarropas_potencia", "below": 3.0, "for": {"minutes": 3}, "id": "t0"}
    assert rule["actions"][0]["service"] == "persistent_notification.create", "sin celulares con la app, el aviso queda en HA"
    ids = [p["plantilla"] for p in (await ejecutar(hass, user, "sugerir_automatizaciones", {"device_id": termo}))["plantillas"]]
    assert ids == ["temperatura_aviso", "aire_prender", "aire_apagar", "humedad_aviso"]
    r = await ejecutar(hass, user, "crear_automatizacion", {"device_id": termo, "plantilla": "aire_prender"})
    assert hass.data[ESC].rules[r["rule_id"]]["actions"] == [
        {"service": "climate.set_temperature", "target": {"entity_id": "climate.aire_dormitorio"}, "data": {"temperature": 24, "hvac_mode": "cool"}}]
    sug = (await ejecutar(hass, user, "sugerir_automatizaciones", {"device_id": boton}))["plantillas"]
    assert sug[0]["parametros"]["pulsacion"]["opciones"] == ["single", "double"], "las pulsaciones que el botón tiene de verdad"
    assert not (await ejecutar(hass, user, "crear_automatizacion", {"device_id": boton, "plantilla": "boton_luces", "parametros": {"pulsacion": "hold"}}))["ok"]
    r = await ejecutar(hass, user, "crear_automatizacion", {"device_id": boton, "plantilla": "boton_luces", "parametros": {"pulsacion": "double"}})
    rule = hass.data[ESC].rules[r["rule_id"]]
    assert rule["ui"]["triggers"] == [{"type": "button", "entity": "event.boton_living", "event_type": "double"}]
    assert rule["actions"] == [{"service": "light.toggle", "target": {"entity_id": "light.living"}}]


async def test_titular_crea_con_sus_permisos(hass, hass_ws_client, hass_client_no_auth, monkeypatch) -> None:
    puerta = await _cocina(hass, monkeypatch)
    ws = await hass_ws_client(hass)
    code = decode((await _link(ws))["code"])["c"]
    _, body = await _pair(await hass_client_no_auth(), code)
    cel = await hass_ws_client(hass, body["token"])
    await cel.send_json({"id": 1, "type": "matterai/alta/tool", "herramienta": "crear_automatizacion",
                         "args": {"device_id": puerta, "plantilla": "puerta_luz_noche", "parametros": {"apagar_en": 5}}})
    r = (await cel.receive_json())["result"]
    assert r["ok"], r
    rule = hass.data[ESC].rules[r["rule_id"]]
    assert not rule["locked"] and rule["created_by"] == "App · Celular de Ana", "es del cliente: la puede editar y borrar"
    # el instalador apagó ese tipo para el cliente → no se puede
    hass.data[ESC].settings["client_off"] = ["watch"]
    await cel.send_json({"id": 2, "type": "matterai/alta/tool", "herramienta": "crear_automatizacion", "args": {"device_id": puerta, "plantilla": "puerta_abierta_aviso"}})
    r = (await cel.receive_json())["result"]
    assert not r["ok"] and "instalador" in r["error"]


async def test_matte_no_crea_sin_confirmacion(hass, monkeypatch) -> None:
    puerta = await _cocina(hass, monkeypatch)
    user = await _admin(hass)
    crear = {"device_id": puerta, "plantilla": "puerta_abierta_aviso", "parametros": {}}
    conv, fake = _con_ia(hass, monkeypatch, [
        # NEGATIVO: crea en el mismo turno en que propone (el cliente no pudo contestar)
        [_use("sugerir_automatizaciones", {"device_id": puerta}), _use("crear_automatizacion", crear)],
        [_txt("¿Querés que te avise si la puerta queda abierta 10 minutos?")],
        # NEGATIVO: una plantilla que nunca se sugirió para este equipo
        [_use("crear_automatizacion", {**crear, "plantilla": "humo_aviso"})],
        [_use("crear_automatizacion", crear)],
        [_txt("Listo, te aviso si queda abierta.")],
    ])
    r1 = await conv.conversar(user, None, "¿Qué automatizaciones me sugerís?")
    assert not hass.data[ESC].rules, "no la creó sin que el cliente conteste"
    results = [b["content"] for m in conv.sesiones[r1["session_id"]]["messages"] if isinstance(m["content"], list)
               for b in m["content"] if b.get("type") == "tool_result"]
    assert "esperá que diga que sí" in results[1]
    r2 = await conv.conversar(user, r1["session_id"], "Sí, dale")
    assert len(hass.data[ESC].rules) == 1 and "Listo" in r2["say"]
    assert next(iter(hass.data[ESC].rules.values()))["ui"]["_alta"]["plantilla"] == "puerta_abierta_aviso"
