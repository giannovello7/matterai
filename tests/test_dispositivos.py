"""Dispositivos de la app: el instalador elige qué dispositivos y entidades usa MatterAI (avisos, voz, app y editor).

Sin selección guardada todo sigue como siempre; la propuesta trae lo usado y lo que tiene ambiente; lo técnico queda
afuera solo; lo nuevo queda «sin revisar». Con pruebas negativas.
"""

from __future__ import annotations

from datetime import timedelta

import pytest

from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.entity import EntityCategory
from homeassistant.util import dt as dt_util

from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.matterai.const import DOMAIN
from custom_components.matterai.health import collect

from .test_seguridad import _link, _pair, _setup, _ws, decode


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    yield


def _device(hass, name, ident, area=None, entities=(), diag=()):
    """Un dispositivo de otra integración con sus entidades (y alguna técnica)."""
    src = MockConfigEntry(domain="demo_x", title=name)
    src.add_to_hass(hass)
    devs, ents = dr.async_get(hass), er.async_get(hass)
    area_id = ar.async_get(hass).async_get_or_create(area).id if area else None
    dev = devs.async_get_or_create(config_entry_id=src.entry_id, identifiers={("demo_x", ident)}, name=name, manufacturer="Marca", model="M1")
    if area_id:
        devs.async_update_device(dev.id, area_id=area_id)
    out = []
    for eid in entities:
        dom, obj = eid.split(".")
        e = ents.async_get_or_create(dom, "demo_x", f"{ident}-{obj}", suggested_object_id=obj, device_id=dev.id, config_entry=src)
        hass.states.async_set(e.entity_id, "on")
        out.append(e.entity_id)
    for eid in diag:
        dom, obj = eid.split(".")
        e = ents.async_get_or_create(dom, "demo_x", f"{ident}-{obj}", suggested_object_id=obj, device_id=dev.id, config_entry=src, entity_category=EntityCategory.DIAGNOSTIC)
        hass.states.async_set(e.entity_id, "-60")
        out.append(e.entity_id)
    return dev.id, out


async def _house(hass):
    await _setup(hass)
    living, _ = _device(hass, "Luz living", "liv", "Living", ["light.living"], ["sensor.living_senal"])
    router, _ = _device(hass, "Router", "rt", None, ["sensor.router_uptime"])
    prueba, _ = _device(hass, "Enchufe de prueba", "pr", None, ["switch.prueba"])
    hass.states.async_set("scene.cine", "scening", {"friendly_name": "Cine"})
    hass.states.async_set("input_boolean.visita", "off", {"friendly_name": "Visita"})
    await hass.async_block_till_done()
    return {"living": living, "router": router, "prueba": prueba}


async def test_sin_seleccion_todo_como_siempre_y_propuesta(hass, hass_ws_client) -> None:
    d = await _house(hass)
    sel = hass.data[DOMAIN]["selection"]
    assert sel.allowed() is None, "sin guardar nada, la app sigue usando todo (las casas que andaban no cambian)"
    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": "matterai/config"})
    assert "app_entities" not in (await ws.receive_json())["result"]["config"]
    await ws.send_json({"id": 2, "type": "matterai/entities/list"})
    r = (await ws.receive_json())["result"]
    by = {x["id"]: x for x in r["devices"]}
    assert not r["enabled"]
    assert by[d["living"]]["selected"], "propuesta: lo que tiene ambiente"
    assert not by[d["router"]]["selected"] and not by[d["prueba"]]["selected"], "propuesta: lo técnico o de prueba sin ambiente, no"
    assert "sensor.living_senal" not in by[d["living"]]["entities"], "las entidades técnicas ni se listan"
    loose = {x["id"]: x for x in r["loose"]}
    assert loose["scene.cine"]["selected"] and loose["scene.cine"]["group"] == "Escenas"
    assert not loose["input_boolean.visita"]["selected"], "los ayudantes no usados no se proponen"


async def test_guardar_filtra_app_avisos_y_voz(hass, hass_ws_client) -> None:
    d = await _house(hass)
    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": "matterai/entities/save", "devices": [d["living"]], "entities": ["scene.cine"]})
    r = await ws.receive_json()
    assert r["success"] and r["result"]["count"] >= 2
    sel = hass.data[DOMAIN]["selection"]
    ok = sel.allowed()
    assert "light.living" in ok and "scene.cine" in ok
    assert "sensor.living_senal" not in ok, "lo técnico de un dispositivo elegido queda afuera solo"
    assert "switch.prueba" not in ok and "sensor.router_uptime" not in ok, "NEGATIVO: lo no elegido no entra"
    # la app recibe la lista
    await ws.send_json({"id": 2, "type": "matterai/config"})
    cfg = (await ws.receive_json())["result"]["config"]
    assert "light.living" in cfg["app_entities"] and "switch.prueba" not in cfg["app_entities"]
    # los avisos de fallas: sólo de lo elegido
    old = dt_util.utcnow() - timedelta(hours=2)
    hass.states.async_set("switch.prueba", "unavailable")
    hass.states.async_set("light.living", "unavailable")
    for eid in ("switch.prueba", "light.living"):
        hass.states.get(eid).last_changed = old  # noqa: SLF001 — sin responder hace rato
    texts = " | ".join(a["text"] for a in collect(hass)["alerts"])
    assert "Sin responder: Luz living" in texts, "falla de un dispositivo elegido: avisa"
    assert "Sin responder: Enchufe de prueba" not in texts, "NEGATIVO: falla de algo no elegido: no avisa"
    # la voz sólo conoce lo elegido
    from custom_components.matterai.voice import house_catalog

    ids = {e["id"] for r in house_catalog(hass, {}) for e in r["equipos"]}
    assert "switch.prueba" not in ids, "NEGATIVO: la voz no controla lo no elegido"


async def test_lo_nuevo_queda_sin_revisar(hass, hass_ws_client) -> None:
    d = await _house(hass)
    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": "matterai/entities/save", "devices": [d["living"]], "entities": []})
    assert (await ws.receive_json())["success"]
    sel = hass.data[DOMAIN]["selection"]
    assert not sel.unreviewed(), "lo que había al guardar ya está revisado"
    nuevo, _ = _device(hass, "Persiana nueva", "pn", "Living", ["cover.persiana"])
    await hass.async_block_till_done()
    new = sel.unreviewed()
    assert [x["name"] for x in new] == ["Persiana nueva"], "un dispositivo agregado después queda sin revisar"
    assert "cover.persiana" not in sel.allowed(), "y no entra solo a la app"
    assert any(a["key"] == "selection:new" for a in collect(hass)["alerts"]), "Salud avisa que hay dispositivos nuevos"
    from custom_components.matterai.setup_steps import collect as steps

    st = {s["key"]: s for s in steps(hass)["steps"]}
    assert st["app_entities"]["ok"] is False and "1 nuevos" in st["app_entities"]["detail"], "la Puesta en marcha lo marca pendiente"
    await ws.send_json({"id": 2, "type": "matterai/entities/save", "devices": [d["living"], nuevo], "entities": []})
    assert (await ws.receive_json())["success"]
    assert not sel.unreviewed() and "cover.persiana" in sel.allowed()
    assert {s["key"]: s for s in steps(hass)["steps"]}["app_entities"]["ok"] is True


async def test_volver_a_todo_y_no_se_guarda_en_la_config(hass, hass_ws_client) -> None:
    d = await _house(hass)
    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": "matterai/entities/save", "devices": [d["living"]], "entities": []})
    assert (await ws.receive_json())["success"]
    # el editor guarda la config completa (con la lista que recibió): no tiene que quedar guardada
    await ws.send_json({"id": 2, "type": "matterai/config/save", "config": {"rooms": [], "app_entities": ["switch.prueba"]}})
    assert (await ws.receive_json())["success"]
    assert "app_entities" not in hass.data[DOMAIN]["dashboard"].config
    await ws.send_json({"id": 3, "type": "matterai/config"})
    assert "switch.prueba" not in (await ws.receive_json())["result"]["config"]["app_entities"], "siempre la lista actual, no la que mandó el editor"
    await ws.send_json({"id": 4, "type": "matterai/entities/save", "devices": [], "entities": [], "enabled": False})
    assert (await ws.receive_json())["success"]
    assert hass.data[DOMAIN]["selection"].allowed() is None, "«Mostrar todo sin filtrar» vuelve a como era"


async def test_solo_el_instalador(hass, hass_ws_client, hass_client_no_auth) -> None:
    await _house(hass)
    ws = await hass_ws_client(hass)
    client = await hass_client_no_auth()
    _, p = await _pair(client, decode((await _link(ws))["code"])["c"], "Celular de Ana")
    msg = await _ws(hass_ws_client, hass, p["token"], 1, {"type": "matterai/entities/list"})
    assert not msg["success"], "NEGATIVO: un celular no ve la lista de dispositivos"
    msg = await _ws(hass_ws_client, hass, p["token"], 1, {"type": "matterai/entities/save", "devices": [], "entities": []})
    assert not msg["success"], "NEGATIVO: ni la cambia"


async def test_avisos_llevan_a_donde_se_arregla(hass) -> None:
    """Un equipo «sin responder» es el que no contesta en nada; cada aviso trae su link."""
    await _setup(hass)
    tele, _ = _device(hass, "Tele", "tv", "Living", ["media_player.tele", "switch.tele_power"])
    luz, _ = _device(hass, "Luz pasillo", "lp", "Pasillo", ["light.pasillo"])
    old = dt_util.utcnow() - timedelta(hours=3)
    for eid in ("media_player.tele", "light.pasillo"):
        hass.states.async_set(eid, "unavailable")
        hass.states.get(eid).last_changed = old  # noqa: SLF001
    al = {a["key"]: a for a in collect(hass)["alerts"]}
    assert f"unavailable:{tele}" not in al, "NEGATIVO: si una parte anda (el enchufe), el equipo no está «sin responder»"
    a = al[f"unavailable:{luz}"]
    assert a["text"] == "Sin responder: Luz pasillo" and a["go"] == f"/config/devices/device/{luz}", "lleva al dispositivo"
    for i in range(10):  # muchos: un aviso con la lista, cada uno con su link
        d, _ = _device(hass, f"Sensor {i}", f"s{i}", "Patio", [f"sensor.patio_{i}"])
        hass.states.async_set(f"sensor.patio_{i}", "unavailable")
        hass.states.get(f"sensor.patio_{i}").last_changed = old  # noqa: SLF001
    many = next(a for a in collect(hass)["alerts"] if a["key"] == "unavailable:many")
    assert len(many["items"]) == 11 and all(x["url"].startswith("/config/devices/device/") for x in many["items"])
    assert many["items"][0]["area"] and many["items"][0]["since"]


async def test_camaras_siempre(hass, hass_ws_client) -> None:
    """Las cámaras de Frigate suelen no tener ambiente: la propuesta las trae y, aunque no se elijan, la app las tiene."""
    d = await _house(hass)
    cam, _ = _device(hass, "Portón", "fcam", None, ["camera.porton"])
    await hass.async_block_till_done()
    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": "matterai/entities/list"})
    by = {x["id"]: x for x in (await ws.receive_json())["result"]["devices"]}
    assert by[cam]["selected"], "la propuesta trae la cámara aunque no tenga ambiente"
    await ws.send_json({"id": 2, "type": "matterai/entities/save", "devices": [d["living"]], "entities": []})
    assert (await ws.receive_json())["success"]
    assert "camera.porton" in hass.data[DOMAIN]["selection"].allowed(), "una selección vieja sin la cámara no deja a la app sin cámaras"
