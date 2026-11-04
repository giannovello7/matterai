"""Privacidad: consentimientos versionados (con IP y equipo), exportar mis datos y pedidos ARCO. Con pruebas negativas."""

from __future__ import annotations

import json

import pytest

from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.matterai.app_devices import APP_ID
from custom_components.matterai.const import DOMAIN

from .test_seguridad import _link, _pair, _setup, _ws, decode


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    yield


async def _phone(hass, hass_ws_client, hass_client_no_auth, name="Ana"):
    ws = await hass_ws_client(hass)
    client = await hass_client_no_auth()
    _, ana = await _pair(client, decode((await _link(ws))["code"])["c"], name)
    return ws, ana


async def test_consent_recorded_with_version_ip_and_device(hass, hass_ws_client, hass_client_no_auth, hass_client) -> None:
    await _setup(hass)
    ws, ana = await _phone(hass, hass_ws_client, hass_client_no_auth)
    from aiohttp.test_utils import TestClient  # noqa: PLC0415, F401

    client = await hass_client_no_auth()
    body = {"device": "Ana", "device_id": "dev-ana", "items": [
        {"doc": "terms", "version": "2026-11-01", "accepted": True},
        {"doc": "privacy", "version": "2026-11-01", "accepted": True},
        {"doc": "marketing", "version": "2026-11-01", "accepted": False},
        {"doc": "inventado", "version": "1", "accepted": True},
    ]}
    r = await client.post("/api/matterai/consent", json=body, headers={"Authorization": f"Bearer {ana['token']}"})
    assert r.status == 200 and (await r.json())["saved"] == 3, "se guardan los documentos conocidos (el inventado no)"
    pv = hass.data[DOMAIN]["privacy"]
    rows = pv.consents[ana["user_id"]]
    assert {x["doc"] for x in rows} == {"terms", "privacy", "marketing"}
    assert all(x["ip"] and x["at"] and x["device"] == "Ana" and x["version"] == "2026-11-01" for x in rows), "con fecha, IP, equipo y versión"
    # revocar queda en la historia (no se pisa lo anterior)
    await client.post("/api/matterai/consent", json={"items": [{"doc": "marketing", "version": "2026-11-01", "accepted": True}]}, headers={"Authorization": f"Bearer {ana['token']}"})
    await client.post("/api/matterai/consent", json={"items": [{"doc": "marketing", "version": "2026-11-01", "accepted": False}]}, headers={"Authorization": f"Bearer {ana['token']}"})
    assert [x["accepted"] for x in pv.consents[ana["user_id"]] if x["doc"] == "marketing"] == [False, True, False]
    msg = await _ws(hass_ws_client, hass, ana["token"], 1, {"type": "matterai/app/consents"})
    assert msg["result"]["current"]["marketing"]["accepted"] is False and msg["result"]["current"]["terms"]["accepted"] is True
    assert any(e["kind"] == "legal" and "Términos" in e["what"] for e in hass.data[DOMAIN]["audit"].entries), "queda en el registro de auditoría"


async def test_consent_negatives(hass, hass_ws_client, hass_client_no_auth, hass_read_only_access_token) -> None:
    await _setup(hass)
    client = await hass_client_no_auth()
    r = await client.post("/api/matterai/consent", json={"items": [{"doc": "terms", "accepted": True}]})
    assert r.status == 401  # NEGATIVO: sin acceso de un equipo no se registra nada
    r = await client.post("/api/matterai/consent", json={"items": [{"doc": "terms", "accepted": True}]}, headers={"Authorization": f"Bearer {hass_read_only_access_token}"})
    assert r.status == 403  # NEGATIVO: un usuario que no es de la casa tampoco
    ws, ana = await _phone(hass, hass_ws_client, hass_client_no_auth)
    r = await client.post("/api/matterai/consent", json={"items": []}, headers={"Authorization": f"Bearer {ana['token']}"})
    assert r.status == 400
    r = await client.post("/api/matterai/consent", data="basura", headers={"Authorization": f"Bearer {ana['token']}"})
    assert r.status == 400


async def test_export_has_my_data_and_no_secrets(hass, hass_ws_client, hass_client_no_auth) -> None:
    await _setup(hass)
    ws, ana = await _phone(hass, hass_ws_client, hass_client_no_auth)
    _, juan = await _phone(hass, hass_ws_client, hass_client_no_auth, "Juan")
    MockConfigEntry(domain="mobile_app", data={"app_id": APP_ID, "device_id": "dev-ana", "device_name": "Ana", "user_id": ana["user_id"],
                                               "webhook_id": "WEBHOOK-SECRETO", "manufacturer": "Samsung", "model": "A54",
                                               "app_data": {"push_token": "PUSH-SECRETO"}}).add_to_hass(hass)
    hass.bus.async_fire("matterai_app_action", {"entity_id": ["light.living"], "service": "light.toggle", "device": "Ana", "device_id": "dev-ana"})
    hass.bus.async_fire("matterai_app_action", {"entity_id": ["light.x"], "service": "light.toggle", "device": "Juan", "device_id": "dev-juan"})
    await hass.async_block_till_done()
    msg = await _ws(hass_ws_client, hass, ana["token"], 1, {"type": "matterai/app/export", "device_id": "dev-ana"})
    assert msg["success"], msg
    data = msg["result"]
    blob = json.dumps(data, ensure_ascii=False)
    assert data["equipo"]["name"] == "Ana" and data["registros_en_la_casa"][0]["modelo"] == "A54"
    assert [a["device"] for a in data["ordenes_dadas"]] == ["Ana"], "sólo lo de este equipo"
    assert "Juan" not in blob  # NEGATIVO: no aparecen datos de otro equipo de la casa
    assert "SECRETO" not in blob and ana["token"] not in blob and "refresh_id" not in blob  # NEGATIVO: sin claves ni tokens
    msg = await _ws(hass_ws_client, hass, juan["token"], 2, {"type": "matterai/app/export", "device_id": "dev-ana"})
    assert "A54" not in json.dumps(msg["result"]), "NEGATIVO: Juan no puede exportar los datos de Ana pasando su device_id"


async def test_arco_request_flow(hass, hass_ws_client, hass_client_no_auth, hass_read_only_access_token) -> None:
    await _setup(hass)
    ws, ana = await _phone(hass, hass_ws_client, hass_client_no_auth)
    msg = await _ws(hass_ws_client, hass, ana["token"], 1, {"type": "matterai/app/arco", "kind": "delete", "detail": "Me mudé"})
    assert msg["success"] and msg["result"]["status"] == "open"
    rid = msg["result"]["id"]
    from custom_components.matterai.health import async_security_alerts  # noqa: PLC0415

    assert any(a["key"] == f"arco:{rid}" for a in await async_security_alerts(hass)), "le llega al instalador (y al panel central)"
    msg = await _ws(hass_ws_client, hass, hass_read_only_access_token, 2, {"type": "matterai/app/arco", "kind": "access"})
    assert not msg["success"]  # NEGATIVO: alguien que no es de la casa no puede cargar pedidos
    msg = await _ws(hass_ws_client, hass, ana["token"], 3, {"type": "matterai/privacy/arco_resolve", "request_id": rid})
    assert not msg["success"]  # NEGATIVO: el celular no puede darlo por resuelto
    await ws.send_json({"id": 4, "type": "matterai/privacy/arco_resolve", "request_id": rid, "note": "Datos borrados el 4/11"})
    assert (await ws.receive_json())["success"]
    assert not any(a["key"] == f"arco:{rid}" for a in await async_security_alerts(hass))
    await ws.send_json({"id": 5, "type": "matterai/privacy/arco_list"})
    reqs = (await ws.receive_json())["result"]["requests"]
    assert reqs[0]["status"] == "done" and reqs[0]["note"] == "Datos borrados el 4/11" and reqs[0]["resolved_at"], "queda el registro con la resolución"
    acts = [e["what"] for e in hass.data[DOMAIN]["audit"].entries]
    assert "pedido: Baja y borrado de mis datos" in acts and "pedido resuelto: Baja y borrado de mis datos" in acts
