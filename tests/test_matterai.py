"""Pruebas de la integración MatterAI sobre un Home Assistant de prueba (pytest-homeassistant-custom-component)."""

from __future__ import annotations

import base64
import json

import pytest

from homeassistant import config_entries
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.helpers.storage import Store
from homeassistant.setup import async_setup_component

from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.matterai.const import DOMAIN
from custom_components.matterai.cors import cors_status
from custom_components.matterai.dashboard import find_card
from custom_components.matterai.health import collect
from custom_components.matterai.house import encode_pairing

DATA = {"name": "Casa Pérez", "url": "https://perez.matterai.com.ar", "support_phone": "5491100000000", "central_key": "", "central_url": "https://panel.matterai.com.ar"}


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    yield


async def _validate(hass, token):
    res = hass.auth.async_validate_access_token(token)
    return await res if hasattr(res, "__await__") else res


def decode(code: str) -> dict:
    return json.loads(base64.urlsafe_b64decode(code + "=" * (-len(code) % 4)).decode("utf-8"))


async def _setup(hass: HomeAssistant, data=None) -> MockConfigEntry:
    await async_setup_component(hass, "http", {})
    entry = MockConfigEntry(domain=DOMAIN, data=data or DATA, title="MatterAI · Casa Pérez")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


# ---------------- alta ----------------

async def test_config_flow(hass: HomeAssistant) -> None:
    await async_setup_component(hass, "http", {})
    res = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    assert res["type"] is FlowResultType.FORM
    res = await hass.config_entries.flow.async_configure(res["flow_id"], {"name": "Casa Pérez", "url": "perez.matterai.com.ar/", "support_phone": "+54 9 11 0000-0000"})
    assert res["type"] is FlowResultType.CREATE_ENTRY
    assert res["data"]["url"] == "https://perez.matterai.com.ar"  # se completa y se limpia
    assert res["data"]["support_phone"] == "5491100000000"  # sólo números
    await hass.async_block_till_done()
    again = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    assert again["type"] is FlowResultType.ABORT  # una sola por casa


async def test_config_flow_bad_url(hass: HomeAssistant) -> None:
    res = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    res = await hass.config_entries.flow.async_configure(res["flow_id"], {"name": "X", "url": "  "})
    assert res["type"] is FlowResultType.FORM and res["errors"] == {"url": "bad_url"}


# (la vinculación de celulares y sus pruebas negativas están en test_seguridad.py)


# ---------------- configuración del dashboard ----------------

async def test_config_ws_and_permissions(hass: HomeAssistant, hass_ws_client, hass_read_only_access_token) -> None:
    await _setup(hass)
    admin = await hass_ws_client(hass)
    await admin.send_json({"id": 1, "type": "matterai/config/subscribe"})
    assert (await admin.receive_json())["success"]
    first = await admin.receive_json()
    assert first["type"] == "event" and first["event"]["config"]["support_phone"] == "5491100000000"

    await admin.send_json({"id": 2, "type": "matterai/config/save", "config": {"type": "custom:matterai-home-card", "installer": "MatterAI", "rooms": [{"name": "Living", "entities": ["light.x"]}]}})
    # primero llega el aviso a quien está escuchando (la app) y después la respuesta
    got = [await admin.receive_json(), await admin.receive_json()]
    ev = next(m for m in got if m.get("type") == "event")
    assert ev["event"]["config"]["rooms"][0]["name"] == "Living" and "type" not in ev["event"]["config"]
    assert next(m for m in got if m.get("id") == 2)["success"]

    # un usuario común (como el de la app) puede leer pero no guardar
    user = await hass_ws_client(hass, hass_read_only_access_token)
    await user.send_json({"id": 1, "type": "matterai/config"})
    res = await user.receive_json()
    assert res["success"] and res["result"]["config"]["rooms"][0]["name"] == "Living" and res["result"]["name"] == "Casa Pérez"
    await user.send_json({"id": 2, "type": "matterai/config/save", "config": {}})
    assert not (await user.receive_json())["success"]
    await user.send_json({"id": 3, "type": "matterai/pairing"})
    assert not (await user.receive_json())["success"]  # el QR (con el acceso) sólo lo ve el instalador


async def test_persists_config(hass: HomeAssistant, hass_ws_client, hass_storage) -> None:
    await _setup(hass)
    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": "matterai/config/save", "config": {"installer": "Otra marca"}})
    await ws.receive_json()
    await hass.async_block_till_done()
    from homeassistant.util import dt  # noqa: F401
    store = Store(hass, 1, "matterai.dashboard")
    assert (await store.async_load())["config"]["installer"] == "Otra marca"


def test_find_card() -> None:
    cfg = {"views": [{"cards": [{"type": "vertical-stack", "cards": [{"type": "custom:matterai-home-card", "installer": "X"}]}]}]}
    assert find_card(cfg)["installer"] == "X"
    assert find_card({"views": []}) is None


# ---------------- estado / panel central ----------------

async def test_health_alerts(hass: HomeAssistant) -> None:
    hass.states.async_set("light.living", "on")
    hass.states.async_set("light.cocina", "unavailable", {"friendly_name": "Cocina"})
    hass.states.async_set("sensor.puerta_bateria", "8", {"device_class": "battery", "friendly_name": "Puerta"})
    hass.states.async_set("alarm_control_panel.casa", "triggered", {"friendly_name": "Casa"})
    data = collect(hass)
    texts = " | ".join(a["text"] for a in data["alerts"])
    # recién apagada no avisa (un corte de un minuto no molesta); a los 15 minutos sí
    assert data["stats"]["lights_on"] == 1 and data["stats"]["unavailable"] == 0 and data["stats"]["unavailable_recent"] == 1
    assert "Alarma disparada: Casa" in texts and "Pila baja: Puerta (8%)" in texts
    from datetime import timedelta  # noqa: PLC0415
    from unittest.mock import patch  # noqa: PLC0415

    from homeassistant.util import dt as dt_util  # noqa: PLC0415

    with patch("custom_components.matterai.health.dt_util.utcnow", return_value=dt_util.utcnow() + timedelta(minutes=20)):
        data = collect(hass)
    assert data["stats"]["unavailable"] == 1 and "Sin responder: Cocina" in " | ".join(a["text"] for a in data["alerts"])


async def test_heartbeat(hass: HomeAssistant, aioclient_mock, hass_ws_client) -> None:
    aioclient_mock.post("https://panel.matterai.com.ar/api/heartbeat", json={"ok": True})
    await _setup(hass, {**DATA, "central_key": "clave123"})
    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": "matterai/heartbeat"})
    res = await ws.receive_json()
    assert res["result"]["ok"] is True
    method, url, body, headers = aioclient_mock.mock_calls[-1]
    assert str(url) == "https://panel.matterai.com.ar/api/heartbeat" and headers["Authorization"] == "Bearer clave123"
    assert body["name"] == "Casa Pérez" and body["url"] == "https://perez.matterai.com.ar" and "alerts" in body


def _http_file(hass, data, version=2) -> None:
    import os
    os.makedirs(hass.config.path(".storage"), exist_ok=True)
    with open(hass.config.path(".storage", "http"), "w", encoding="utf-8") as f:
        json.dump({"version": version, "minor_version": 2, "key": "http", "data": data}, f)


async def test_status(hass: HomeAssistant, hass_ws_client) -> None:
    _http_file(hass, {"stable": {"cors_allowed_origins": ["https://cast.home-assistant.io"]}, "pending": None})
    await _setup(hass)
    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": "matterai/status"})
    s = (await ws.receive_json())["result"]
    assert s["name"] == "Casa Pérez" and s["cors"]["known"] and "https://app.matterai.com.ar" in s["cors"]["missing"]
    assert s["central"]["configured"] is False


async def test_cors_formats(hass: HomeAssistant) -> None:
    import os
    from custom_components.matterai.const import APP_ORIGINS

    both = list(APP_ORIGINS)  # Android/web, iPhone y pruebas
    assert "capacitor://app.matterai.com.ar" in both, "la app de iPhone se conecta desde capacitor://"
    _http_file(hass, {"stable": {"cors_allowed_origins": both}, "pending": None})  # HA 2026
    st = await cors_status(hass)
    assert st["known"] and st["missing"] == [] and st["needs_restart"] is False
    _http_file(hass, {"stable": {"cors_allowed_origins": []}, "pending": {"cors_allowed_origins": both}})  # guardado, falta reiniciar
    st = await cors_status(hass)
    assert st["missing"] == [] and st["needs_restart"] is True
    _http_file(hass, {"cors_allowed_origins": ["https://cast.home-assistant.io"]}, version=1)  # HA 2025
    assert (await cors_status(hass))["missing"] == both
    before = open(hass.config.path(".storage", "http"), encoding="utf-8").read()
    await cors_status(hass)
    assert open(hass.config.path(".storage", "http"), encoding="utf-8").read() == before  # nunca lo modifica
    os.remove(hass.config.path(".storage", "http"))
    assert (await cors_status(hass))["missing"] == both


def test_encode_pairing_matches_app() -> None:
    # mismo formato que encodePairing() de la app: base64url sin "=" de JSON UTF-8
    code = encode_pairing({"u": "https://x.ar", "t": "tok", "n": "Casa Ñandú", "s": None})
    assert "=" not in code and decode(code) == {"u": "https://x.ar", "t": "tok", "n": "Casa Ñandú"}


async def test_imports_existing_panel_config(hass: HomeAssistant, hass_ws_client, hass_storage) -> None:
    """Primera instalación en una casa que ya tenía la tarjeta en un panel: se trae su configuración."""
    hass_storage["lovelace"] = {"version": 1, "minor_version": 1, "key": "lovelace", "data": {"config": {"views": [{"type": "panel", "cards": [
        {"type": "custom:matterai-home-card", "installer": "MatterAI", "floorplan": {"image": "/local/q.svg", "zones": [{"name": "Cocina", "area": [1, 2, 3, 4], "lights": ["light.cocina"]}]}}]}]}}}
    assert await async_setup_component(hass, "lovelace", {})
    await _setup(hass)
    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": "matterai/config"})
    cfg = (await ws.receive_json())["result"]["config"]
    assert cfg["floorplan"]["zones"][0]["name"] == "Cocina" and "type" not in cfg
    await ws.send_json({"id": 2, "type": "matterai/status"})
    assert (await ws.receive_json())["result"]["imported_from"] == "lovelace"


async def test_card_resource_replaces_old_copy(hass: HomeAssistant, hass_storage) -> None:
    """La copia vieja (/local/...?v=1) se reemplaza por la de la integración: nunca más «?v=» a mano."""
    from homeassistant.core import CoreState

    hass_storage["lovelace_resources"] = {"version": 1, "minor_version": 1, "key": "lovelace_resources", "data": {"items": [
        {"id": "a", "type": "module", "url": "/local/matterai-home/matterai-home-card.js?v=1"},
        {"id": "b", "type": "module", "url": "/hacsfiles/otra/otra.js"}]}}
    assert await async_setup_component(hass, "lovelace", {})
    hass.set_state(CoreState.not_running)
    await _setup(hass)
    hass.set_state(CoreState.running)
    from homeassistant.const import EVENT_HOMEASSISTANT_STARTED
    hass.bus.async_fire(EVENT_HOMEASSISTANT_STARTED)
    await hass.async_block_till_done()
    lovelace = hass.data["lovelace"]
    res = lovelace["resources"] if isinstance(lovelace, dict) else lovelace.resources
    urls = [i["url"] for i in res.async_items()]
    assert any(u.startswith("/matterai_static/matterai-loader.js?f=matterai-home-card.js") for u in urls)  # el cargador trae la última tarjeta
    assert sum("matterai-home-card" in u for u in urls) == 1, urls  # una sola tarjeta (la de automatizaciones va aparte)
    assert not any("/local/matterai-home/" in u for u in urls)
    assert "/hacsfiles/otra/otra.js" in urls  # las demás no se tocan


async def test_pairing_with_local_address(hass: HomeAssistant, hass_ws_client, hass_admin_user) -> None:
    """Con dirección local y wifi, la app se conecta directo en la casa (como la app de HA)."""
    res = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    bad = await hass.config_entries.flow.async_configure(res["flow_id"], {"name": "Casa", "url": "perez.matterai.com.ar", "local_url": "192.168.1.50:8123/lovelace"})
    assert bad["errors"] == {"local_url": "bad_local_url"}
    res = await hass.config_entries.flow.async_configure(res["flow_id"], {"name": "Casa", "url": "perez.matterai.com.ar", "local_url": "192.168.1.50:8123/", "wifi": " Casa Pérez ,, Casa Pérez 5G "})
    assert res["data"]["local_url"] == "http://192.168.1.50:8123" and res["data"]["wifi"] == "Casa Pérez, Casa Pérez 5G"
    await hass.async_block_till_done()
    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": "matterai/pairing"})
    data = decode((await ws.receive_json())["result"]["code"])
    assert data["l"] == "http://192.168.1.50:8123" and data["w"] == ["Casa Pérez", "Casa Pérez 5G"]
