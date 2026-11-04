"""Registro de auditoría de la casa y acceso opcional del instalador (con pruebas negativas)."""

from __future__ import annotations

import time

import pytest

from homeassistant.auth.const import GROUP_ID_ADMIN
from homeassistant.core import Context

from custom_components.matterai.const import DOMAIN

from .test_seguridad import _link, _pair, _setup, _ws, decode


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    yield


def _audit(hass):
    return hass.data[DOMAIN]["audit"]


async def test_audit_logs_critical_actions_with_who(hass, hass_ws_client, hass_client_no_auth) -> None:
    await _setup(hass)
    for dom, svc in (("lock", "unlock"), ("light", "turn_on"), ("cover", "open_cover"), ("alarm_control_panel", "alarm_disarm")):
        hass.services.async_register(dom, svc, lambda call: None)
    hass.states.async_set("cover.porton", "closed", {"device_class": "gate"})
    hass.states.async_set("cover.cortina", "closed", {"device_class": "curtain"})
    ws = await hass_ws_client(hass)
    client = await hass_client_no_auth()
    _, ana = await _pair(client, decode((await _link(ws))["code"])["c"], "Ana")
    ctx = Context(user_id=ana["user_id"])
    await hass.services.async_call("lock", "unlock", {"entity_id": "lock.puerta"}, blocking=True, context=ctx)
    await hass.services.async_call("light", "turn_on", {"entity_id": "light.living"}, blocking=True, context=ctx)
    await hass.services.async_call("cover", "open_cover", {"entity_id": "cover.cortina"}, blocking=True, context=ctx)
    await hass.services.async_call("cover", "open_cover", {"entity_id": "cover.porton"}, blocking=True, context=ctx)
    await hass.services.async_call("alarm_control_panel", "alarm_disarm", {"entity_id": "alarm_control_panel.casa"}, blocking=True)
    hass.bus.async_fire("matterai_app_action", {"entity_id": ["camera.patio"], "service": "camera.view", "device": "Ana"})
    await hass.async_block_till_done()
    a = _audit(hass)
    crit = [e for e in a.entries if e["kind"] == "critical"]
    assert [(e["what"], e["target"]) for e in crit] == [
        ("lock.unlock", "lock.puerta"), ("cover.open_cover", "cover.porton"), ("alarm_control_panel.alarm_disarm", "alarm_control_panel.casa")]
    assert crit[0]["who"] == "app · Ana" and crit[2]["who"] == "automatización"
    assert any(e["kind"] == "camera" and e["target"] == "camera.patio" for e in a.entries), "cámara vista desde la app"
    assert any(e["what"] == "equipo vinculado" and e["target"] == "Ana" for e in a.entries)
    assert not any("light" in e["what"] or "cortina" in e["target"] for e in a.entries), "las luces y cortinas no llenan el registro"

    await ws.send_json({"id": 9, "type": "matterai/audit"})
    res = (await ws.receive_json())["result"]
    assert res["integrity"]["ok"] and res["entries"][0]["kind"] == "camera", "el instalador lo ve (lo último primero)"
    msg = await _ws(hass_ws_client, hass, ana["token"], 1, {"type": "matterai/audit"})
    assert not msg["success"]  # NEGATIVO: un celular no ve el registro


async def test_audit_detects_tampering(hass) -> None:
    await _setup(hass)
    a = _audit(hass)
    for i in range(3):
        a.add("critical", "lock.unlock", f"lock.{i}", "app · Ana")
    assert a.verify()["ok"]
    a.entries[1]["who"] = "nadie"
    assert not a.verify()["ok"] and a.verify()["broken_at"] == 1  # NEGATIVO: cambiar una entrada se detecta
    a.entries[1]["who"] = "app · Ana"
    del a.entries[1]
    assert not a.verify()["ok"]  # NEGATIVO: borrar una entrada también


async def test_audit_trims_but_stays_verifiable(hass) -> None:
    from custom_components.matterai import audit as A  # noqa: PLC0415

    await _setup(hass)
    a = _audit(hass)
    old = A.MAX_ENTRIES
    A.MAX_ENTRIES = 5
    try:
        for i in range(9):
            a.add("critical", "lock.unlock", f"lock.{i}")
    finally:
        A.MAX_ENTRIES = old
    assert len(a.entries) == 5 and a.anchor and a.verify()["ok"], "se recorta lo viejo y la cadena sigue verificable"


async def test_support_owner_mode(hass, hass_ws_client, hass_client_no_auth, hass_admin_user) -> None:
    await _setup(hass)
    a = _audit(hass)
    ws = await hass_ws_client(hass)
    client = await hass_client_no_auth()
    _, ana = await _pair(client, decode((await _link(ws, 1))["code"])["c"], "Ana")
    soporte = await hass.auth.async_create_user("MatterAI Soporte", group_ids=[GROUP_ID_ADMIN])
    owner = await hass.auth.async_create_user("Dueño HA", group_ids=[GROUP_ID_ADMIN])
    owner.is_owner = True

    # por defecto: permanente, el celular no puede tocar nada
    msg = await _ws(hass_ws_client, hass, ana["token"], 2, {"type": "matterai/app/support_grant", "hours": 2})
    assert not msg["success"] and msg["error"]["code"] == "not_owner_mode"
    # NEGATIVO: la cuenta dueña nunca puede quedar como usuario de soporte (es la llave de emergencia)
    await ws.send_json({"id": 3, "type": "matterai/support/set", "mode": "owner", "user_id": owner.id})
    assert not (await ws.receive_json())["success"]
    await ws.send_json({"id": 4, "type": "matterai/support/set", "mode": "owner", "user_id": soporte.id, "notify": True})
    assert (await ws.receive_json())["success"]
    await hass.async_block_till_done()
    assert not soporte.is_active, "en modo «lo habilita el dueño», el usuario de soporte queda desactivado"

    msg = await _ws(hass_ws_client, hass, ana["token"], 5, {"type": "matterai/app/support_grant", "hours": 2})
    assert msg["success"] and soporte.is_active and msg["result"]["open"], "el dueño lo habilita desde la app"
    assert any(e["what"] == "acceso del instalador habilitado" and e["who"] == "app · Ana" for e in a.entries)
    msg = await _ws(hass_ws_client, hass, ana["token"], 6, {"type": "matterai/app/support_grant", "hours": 1000})
    assert not msg["success"]  # NEGATIVO: horas raras no
    await ws.send_json({"id": 7, "type": "matterai/app/support_grant", "hours": 24})
    assert not (await ws.receive_json())["success"]  # NEGATIVO: el instalador no se habilita a sí mismo

    a.support["until"] = time.time() - 1  # vence
    await a._watch_admins()  # noqa: SLF001
    assert not soporte.is_active, "al vencer se desactiva solo"

    await ws.send_json({"id": 8, "type": "matterai/support/set", "mode": "always"})
    assert (await ws.receive_json())["success"]
    assert soporte.is_active, "volver a «permanente» lo reactiva"


async def test_support_grant_denied_for_kids_and_strangers(hass, hass_ws_client, hass_client_no_auth, hass_read_only_access_token) -> None:
    await _setup(hass)
    ws = await hass_ws_client(hass)
    soporte = await hass.auth.async_create_user("MatterAI Soporte", group_ids=[GROUP_ID_ADMIN])
    await ws.send_json({"id": 1, "type": "matterai/support/set", "mode": "owner", "user_id": soporte.id})
    assert (await ws.receive_json())["success"]
    client = await hass_client_no_auth()
    _, nene = await _pair(client, decode((await _link(ws, 2))["code"])["c"], "Tablet chicos")
    await ws.send_json({"id": 3, "type": "matterai/app/device_set", "device_id": "dev-kids", "profile": "kids"})
    assert (await ws.receive_json())["success"]
    msg = await _ws(hass_ws_client, hass, nene["token"], 4, {"type": "matterai/app/support_grant", "hours": 24, "device_id": "dev-kids"})
    assert not msg["success"]  # NEGATIVO: el perfil de los chicos no habilita al instalador
    msg = await _ws(hass_ws_client, hass, hass_read_only_access_token, 5, {"type": "matterai/app/support_grant", "hours": 24})
    assert not msg["success"]  # NEGATIVO: un usuario ajeno tampoco
    assert not soporte.is_active


async def test_installer_access_is_logged(hass, hass_admin_user) -> None:
    await _setup(hass)
    a = _audit(hass)
    rt = await hass.auth.async_create_refresh_token(hass_admin_user, client_id="https://example.com/")
    hass.auth.async_create_access_token(rt, "200.1.2.3")  # marca el último uso
    await a._watch_admins()  # noqa: SLF001
    assert any(e["kind"] == "support" and e["what"] == "acceso del instalador" for e in a.entries)
