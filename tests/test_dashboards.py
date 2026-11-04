"""Dashboards por persona: crear, asignar a equipos, fijar desde la app. Con pruebas negativas."""

from __future__ import annotations

import pytest

from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.matterai.app_devices import APP_ID
from custom_components.matterai.const import DOMAIN

from .test_seguridad import _link, _pair, _setup, _ws, decode


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    yield


async def _phone(hass, hass_ws_client, client, name, dev):
    adm = await hass_ws_client(hass)  # conexión propia: así no se mezclan los números de mensaje de la prueba
    _, p = await _pair(client, decode((await _link(adm))["code"])["c"], name)
    MockConfigEntry(domain="mobile_app", data={"app_id": APP_ID, "device_id": dev, "device_name": name, "user_id": p["user_id"], "webhook_id": f"w-{dev}"}).add_to_hass(hass)
    return p


async def test_installer_creates_and_assigns(hass, hass_ws_client, hass_client_no_auth) -> None:
    await _setup(hass)
    ws = await hass_ws_client(hass)
    client = await hass_client_no_auth()
    gian = await _phone(hass, hass_ws_client, client, "Celu Gianfranco", "dev-g")
    sub = await hass_ws_client(hass, gian["token"])
    await sub.send_json({"id": 1, "type": "matterai/app/subscribe", "device_id": "dev-g", "name": "Celu Gianfranco"})
    assert (await sub.receive_json())["success"]

    await ws.send_json({"id": 10, "type": "matterai/views/save", "view": {"name": "Gianfranco", "kind": "phone", "pinned": ["Garage", "Dormitorio", "Baño", "Garage"],
                                                                         "featured": {"title": "Garage", "camera": "camera.garage", "gate": "cover.porton"}}})
    v = (await ws.receive_json())["result"]
    assert v["pinned"] == ["Garage", "Dormitorio", "Baño"], "sin repetidos, en el orden elegido"
    await ws.send_json({"id": 11, "type": "matterai/views/assign", "device_id": "dev-g", "view_id": v["id"]})
    assert (await ws.receive_json())["success"]
    ev = await sub.receive_json()
    assert ev["event"]["command"] == "view", "el equipo se entera al instante"

    msg = await _ws(hass_ws_client, hass, gian["token"], 2, {"type": "matterai/app/view", "device_id": "dev-g"})
    assert msg["result"]["view"]["name"] == "Gianfranco" and msg["result"]["personal"] is True
    await ws.send_json({"id": 12, "type": "matterai/views/list"})
    res = (await ws.receive_json())["result"]
    assert res["devices"][0]["view"] == v["id"]


async def test_default_view_for_unassigned(hass, hass_ws_client, hass_client_no_auth) -> None:
    await _setup(hass)
    ws = await hass_ws_client(hass)
    client = await hass_client_no_auth()
    flavio = await _phone(hass, hass_ws_client, client, "Celu Flavio", "dev-f")
    msg = await _ws(hass_ws_client, hass, flavio["token"], 1, {"type": "matterai/app/view", "device_id": "dev-f"})
    assert msg["result"]["view"] is None, "sin nada configurado: la app arma el inicio por defecto"
    await ws.send_json({"id": 2, "type": "matterai/views/save", "view": {"name": "General", "pinned": ["Living", "Cocina"]}})
    g = (await ws.receive_json())["result"]
    await ws.send_json({"id": 3, "type": "matterai/views/default", "view_id": g["id"]})
    assert (await ws.receive_json())["success"]
    msg = await _ws(hass_ws_client, hass, flavio["token"], 4, {"type": "matterai/app/view", "device_id": "dev-f"})
    assert msg["result"]["view"]["name"] == "General" and msg["result"]["personal"] is False


async def test_pin_from_app_creates_personal_and_follows_person(hass, hass_ws_client, hass_client_no_auth) -> None:
    await _setup(hass)
    ws = await hass_ws_client(hass)
    client = await hass_client_no_auth()
    gian = await _phone(hass, hass_ws_client, client, "Celu Gianfranco", "dev-g")
    msg = await _ws(hass_ws_client, hass, gian["token"], 1, {"type": "matterai/app/view_pin", "device_id": "dev-g", "pinned": ["Garage", "Dormitorio"]})
    assert msg["success"], msg
    v = msg["result"]
    assert v["name"] == "Celu Gianfranco" and v["pinned"] == ["Garage", "Dormitorio"] and v["by"].startswith("app")
    views = hass.data[DOMAIN]["views"]
    assert views.assign["dev-g"] == v["id"], "se le asigna su dashboard personal"
    # el instalador le asigna el mismo dashboard a la tablet de la misma persona: lo que fija en el celular aparece ahí
    views.set_assign("dev-tablet", v["id"])
    msg = await _ws(hass_ws_client, hass, gian["token"], 2, {"type": "matterai/app/view_pin", "device_id": "dev-g", "pinned": ["Dormitorio", "Garage", "Baño"]})
    assert views.views[v["id"]]["pinned"] == ["Dormitorio", "Garage", "Baño"] and len(views.views) == 1


async def test_cannot_touch_other_peoples_dashboard(hass, hass_ws_client, hass_client_no_auth, hass_read_only_access_token) -> None:
    await _setup(hass)
    ws = await hass_ws_client(hass)
    client = await hass_client_no_auth()
    gian = await _phone(hass, hass_ws_client, client, "Celu Gianfranco", "dev-g")
    flavio = await _phone(hass, hass_ws_client, client, "Celu Flavio", "dev-f")
    await ws.send_json({"id": 1, "type": "matterai/views/save", "view": {"name": "Gianfranco", "pinned": ["Garage"]}})
    v = (await ws.receive_json())["result"]
    await ws.send_json({"id": 2, "type": "matterai/views/assign", "device_id": "dev-g", "view_id": v["id"]})
    await ws.receive_json()
    # NEGATIVO: Flavio no puede cambiar el dashboard de Gianfranco pasando su device_id
    msg = await _ws(hass_ws_client, hass, flavio["token"], 3, {"type": "matterai/app/view_pin", "device_id": "dev-g", "pinned": ["Nada"]})
    assert not msg["success"] and hass.data[DOMAIN]["views"].views[v["id"]]["pinned"] == ["Garage"]
    # NEGATIVO: ni leerlo como propio
    msg = await _ws(hass_ws_client, hass, flavio["token"], 4, {"type": "matterai/app/view", "device_id": "dev-g"})
    assert msg["result"]["personal"] is False
    # NEGATIVO: un celular no usa los comandos del instalador
    for i, payload in enumerate([{"type": "matterai/views/list"}, {"type": "matterai/views/save", "view": {"name": "x"}},
                                 {"type": "matterai/views/assign", "device_id": "dev-f", "view_id": v["id"]}, {"type": "matterai/views/delete", "view_id": v["id"]}]):
        msg = await _ws(hass_ws_client, hass, gian["token"], 10 + i, payload)
        assert not msg["success"] and msg["error"]["code"] == "unauthorized", payload
    # NEGATIVO: un usuario ajeno a la casa no ve dashboards
    msg = await _ws(hass_ws_client, hass, hass_read_only_access_token, 20, {"type": "matterai/app/view", "device_id": "dev-g"})
    assert not msg["success"]


async def test_validation_and_cleanup(hass, hass_ws_client, hass_client_no_auth) -> None:
    await _setup(hass)
    ws = await hass_ws_client(hass)
    for i, bad in enumerate([{"name": ""}, {"name": "x", "kind": "reloj"}, {"name": "x", "featured": {"camera": "no es entidad"}}, {"name": "x", "pinned": ["a"] * 30}]):
        await ws.send_json({"id": 1 + i, "type": "matterai/views/save", "view": bad})
        assert not (await ws.receive_json())["success"], bad  # NEGATIVO: datos inválidos no se guardan
    client = await hass_client_no_auth()
    gian = await _phone(hass, hass_ws_client, client, "Celu Gianfranco", "dev-g")
    await ws.send_json({"id": 10, "type": "matterai/views/save", "view": {"name": "G"}})
    v = (await ws.receive_json())["result"]
    await ws.send_json({"id": 11, "type": "matterai/views/assign", "device_id": "dev-g", "view_id": v["id"]})
    await ws.receive_json()
    await ws.send_json({"id": 12, "type": "matterai/app/revoke", "user_id": gian["user_id"]})
    assert (await ws.receive_json())["success"]
    await hass.async_block_till_done()
    assert "dev-g" not in hass.data[DOMAIN]["views"].assign, "al desvincular un equipo se le saca el dashboard"
    await ws.send_json({"id": 13, "type": "matterai/views/delete", "view_id": v["id"]})
    assert (await ws.receive_json())["success"] and not hass.data[DOMAIN]["views"].views
