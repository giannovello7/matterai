"""Alta de dispositivos, fases 5 y 6: lo que la casa encuentra sola (campanita), WiFi guiado y Matter desde el celular.

Una integración de prueba con descubrimiento (como un Shelly por zeroconf). Con pruebas negativas: usuarios que no son
el titular, equipos que piden contraseña, ids que ya no existen, avisos al celular apagados por defecto.
"""

from __future__ import annotations

from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
import voluptuous as vol

from homeassistant import config_entries
from homeassistant.config_entries import ConfigEntryState
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.util import dt as dt_util

from pytest_homeassistant_custom_component.common import (
    MockConfigEntry,
    MockModule,
    async_fire_time_changed,
    mock_config_flow,
    mock_integration,
    mock_platform,
)

from custom_components.matterai.alta import matter as matter_mod
from custom_components.matterai.alta.herramientas import ejecutar
from custom_components.matterai.const import DOMAIN

from .test_alta_zigbee import _admin, _casa, rapido  # noqa: F401
from .test_seguridad import _link, _pair, decode


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    yield


class ShellyFlow(config_entries.ConfigFlow):
    VERSION = 1

    async def async_step_zeroconf(self, info):
        await self.async_set_unique_id(info["id"])
        self._abort_if_unique_id_configured()
        self.context["title_placeholders"] = {"name": info["name"]}
        self._pw = info.get("password")
        return await self.async_step_confirm()

    async def async_step_confirm(self, user_input=None):
        if user_input is not None:
            return self.async_create_entry(title=self.context["title_placeholders"]["name"], data={})
        schema = vol.Schema({vol.Required("password"): str}) if self._pw else vol.Schema({})
        return self.async_show_form(step_id="confirm", data_schema=schema)


@pytest.fixture
async def shelly(hass):
    mock_integration(hass, MockModule("test_shelly", async_setup_entry=AsyncMock(return_value=True)))
    mock_platform(hass, "test_shelly.config_flow", None)
    with mock_config_flow("test_shelly", ShellyFlow):
        yield


async def _descubrir(hass, ident, name, password=False):
    r = await hass.config_entries.flow.async_init("test_shelly", context={"source": config_entries.SOURCE_ZEROCONF},
                                                  data={"id": ident, "name": name, "password": password})
    hass.bus.async_fire(config_entries.EVENT_FLOW_DISCOVERED)
    await hass.async_block_till_done()
    return r


async def _celular(hass, hass_ws_client, hass_client_no_auth):
    ws = await hass_ws_client(hass)
    code = decode((await _link(ws))["code"])["c"]
    _, body = await _pair(await hass_client_no_auth(), code)
    return ws, await hass_ws_client(hass, body["token"]), body


async def test_campanita_agregar_ignorar_y_mas_tarde(hass, hass_ws_client, hass_client_no_auth, shelly, monkeypatch) -> None:
    await _casa(hass, None, monkeypatch)
    ws, cel, body = await _celular(hass, hass_ws_client, hass_client_no_auth)
    await cel.send_json({"id": 1, "type": "matterai/alta/descubrimientos"})
    assert (await cel.receive_json())["success"]
    assert (await cel.receive_json())["event"]["items"] == []
    await _descubrir(hass, "a1", "Shelly Plus 1PM")
    ev = (await cel.receive_json())["event"]
    assert ev["push"] is False, "avisos al celular apagados de fábrica"
    (item,) = ev["items"]
    assert item["tipo"] == "descubierto" and item["titulo"] == "Shelly Plus 1PM" and item["texto"] == "Se encontró Shelly Plus 1PM en la red"
    # NEGATIVO: un celular con perfil «Sin seguridad» no la ve
    hass.data[DOMAIN]["house"].devices[body["user_id"]]["profile"] = "kids"
    await cel.send_json({"id": 2, "type": "matterai/alta/descubrimientos"})
    assert not (await cel.receive_json())["success"]
    hass.data[DOMAIN]["house"].devices[body["user_id"]].pop("profile")
    user = await _admin(hass)
    # más tarde: sigue en la lista, marcado
    assert (await ejecutar(hass, user, "mas_tarde_descubierto", {"id": item["id"]}))["ok"]
    assert (await ejecutar(hass, user, "listar_descubiertos", {}))["descubiertos"][0]["luego"]
    # agregar: el flujo de HA termina y desaparece de la lista
    out = await ejecutar(hass, user, "agregar_descubierto", {"id": item["id"]})
    assert out["ok"] and out["agregado"]
    await hass.async_block_till_done()
    assert hass.config_entries.async_entries("test_shelly")[0].title == "Shelly Plus 1PM"
    assert (await ejecutar(hass, user, "listar_descubiertos", {}))["descubiertos"] == []
    # ignorar: el ignorar nativo de HA (se recupera desde Integraciones)
    await _descubrir(hass, "b2", "Shelly H&T")
    item = (await ejecutar(hass, user, "listar_descubiertos", {}))["descubiertos"][0]
    assert (await ejecutar(hass, user, "ignorar_descubierto", {"id": item["id"]}))["ok"]
    await hass.async_block_till_done()
    ign = [e for e in hass.config_entries.async_entries("test_shelly") if e.source == config_entries.SOURCE_IGNORE]
    assert len(ign) == 1 and ign[0].unique_id == "b2"
    assert (await ejecutar(hass, user, "listar_descubiertos", {}))["descubiertos"] == []
    whats = [(e["what"], e["target"]) for e in hass.data[DOMAIN]["audit"].entries if e["kind"] == "alta"]
    assert ("descubrimiento agregado", "Shelly Plus 1PM") in whats and ("descubrimiento ignorado", "Shelly H&T") in whats
    # NEGATIVO: uno que ya no existe; uno que pide contraseña
    assert not (await ejecutar(hass, user, "agregar_descubierto", {"id": "flow:test_shelly:zz"}))["ok"]
    await _descubrir(hass, "c3", "Shelly Pro", password=True)
    item = (await ejecutar(hass, user, "listar_descubiertos", {}))["descubiertos"][0]
    out = await ejecutar(hass, user, "agregar_descubierto", {"id": item["id"]})
    assert not out["ok"] and out["pide_datos"] and out["campos"][0]["nombre"] == "password", "pide la contraseña (ver test_alta_zwave)"


async def test_equipo_sin_ambiente_y_wifi_guiado(hass, monkeypatch) -> None:
    await _casa(hass, None, monkeypatch)
    user = await _admin(hass)
    desc = hass.data[DOMAIN]["descubrimientos"]
    src = MockConfigEntry(domain="demo_x")
    src.add_to_hass(hass)
    dev = dr.async_get(hass).async_get_or_create(config_entry_id=src.entry_id, identifiers={("demo_x", "s1")}, name="Sensor", manufacturer="Sonoff", model="SNZB-04")
    e = er.async_get(hass).async_get_or_create("binary_sensor", "demo_x", "s1", device_id=dev.id, config_entry=src, original_device_class="door")
    hass.states.async_set(e.entity_id, "off")
    await hass.async_block_till_done()
    for _ in range(50):  # el equipo termina de aparecer (entidades) fuera de una sesión de alta
        if desc.sin_area:
            break
        await hass.async_block_till_done()
        import asyncio
        await asyncio.sleep(0.02)
    items = (await ejecutar(hass, user, "listar_descubiertos", {}))["descubiertos"]
    assert items[0]["tipo"] == "sin_area" and items[0]["marca"] == "Sonoff" and "sensor de apertura" in items[0]["texto"].lower()
    # agregar: sigue directo con lo que es (para el ambiente y el nombre)
    out = await ejecutar(hass, user, "agregar_descubierto", {"id": items[0]["id"]})
    assert out["ok"] and out["device_id"] == dev.id and out["tipo"] == "puerta"
    # cuando le ponen ambiente, se va solo de la campanita
    dr.async_get(hass).async_update_device(dev.id, area_id=ar.async_get(hass).async_get_or_create("Patio").id)
    await hass.async_block_till_done()
    assert (await ejecutar(hass, user, "listar_descubiertos", {}))["descubiertos"] == []
    # WiFi guiado: arranca la sesión y muestra lo encontrado
    out = await ejecutar(hass, user, "preparar_wifi", {})
    assert out["ok"] and out["descubiertos"] == [] and hass.data[DOMAIN]["alta"].desde


async def test_aviso_al_celular_agrupado(hass, hass_ws_client, hass_client_no_auth, shelly, monkeypatch) -> None:
    await _casa(hass, None, monkeypatch)
    ws, cel, _body = await _celular(hass, hass_ws_client, hass_client_no_auth)
    MockConfigEntry(domain="mobile_app", data={"app_id": "ar.com.matterai.app", "device_id": "cel-ana", "device_name": "Celular Ana", "webhook_id": "w"}).add_to_hass(hass)
    sent: list = []

    async def _notify(call):
        sent.append(dict(call.data))

    hass.services.async_register("notify", "mobile_app_celular_ana", _notify)
    await cel.send_json({"id": 1, "type": "matterai/alta/descubrimientos_push", "device_id": "cel-ana", "on": True})
    assert (await cel.receive_json())["result"]["on"]
    await _descubrir(hass, "a1", "Shelly Plus 1PM")
    await _descubrir(hass, "a2", "Shelly Plug S")
    async_fire_time_changed(hass, dt_util.utcnow() + timedelta(seconds=11))
    await hass.async_block_till_done()
    assert len(sent) == 1 and sent[0]["message"].startswith("Se encontraron 2 dispositivos nuevos"), "un solo aviso para los que aparecen juntos"
    # NEGATIVO: un equipo de la app con los avisos apagados no recibe nada
    hass.data[DOMAIN]["descubrimientos"].set_push("cel-ana", False)
    await _descubrir(hass, "a3", "Shelly Dimmer")
    async_fire_time_changed(hass, dt_util.utcnow() + timedelta(seconds=30))
    await hass.async_block_till_done()
    assert len(sent) == 1


@pytest.fixture
async def matter_simulado_al_final(hass):
    yield
    for e in hass.config_entries.async_entries("matter"):
        e.mock_state(hass, ConfigEntryState.NOT_LOADED)


async def test_matter_y_thread_desde_el_celular(hass, hass_ws_client, hass_client_no_auth, monkeypatch, matter_simulado_al_final, caplog) -> None:
    await _casa(hass, None, monkeypatch)
    ws, cel, body = await _celular(hass, hass_ws_client, hass_client_no_auth)
    m = MockConfigEntry(domain="matter")
    m.add_to_hass(hass)
    m.mock_state(hass, ConfigEntryState.LOADED)
    calls: list = []

    async def on_network(pin, **kw):
        calls.append((pin, kw))
        return SimpleNamespace(node_id=9)

    monkeypatch.setattr(matter_mod, "_cliente", lambda _h: SimpleNamespace(commission_on_network=on_network))
    await cel.send_json({"id": 1, "type": "matterai/alta/matter_red", "pin": 20202021, "ip": "fe80::1"})
    r = (await cel.receive_json())["result"]
    assert r["ok"] and r["node_id"] == 9 and calls == [(20202021, {"ip_addr": "fe80::1"})]
    ours = " ".join(r.getMessage() for r in caplog.records if r.name.startswith("custom_components.matterai"))
    assert "20202021" not in ours and not any("20202021" in str(e) for e in hass.data[DOMAIN]["audit"].entries)
    # la red Thread de la casa, para el celular
    ds = SimpleNamespace(tlv="0e08000000000001", preferred_border_agent_id="ba01", network_name="Casa")
    store = SimpleNamespace(preferred_dataset="d", async_get=lambda i: ds)

    async def _store(_h):
        return store

    monkeypatch.setattr(matter_mod, "_dataset_store", _store)
    await cel.send_json({"id": 2, "type": "matterai/alta/thread_red"})
    r = (await cel.receive_json())["result"]
    assert r == {"ok": True, "tlv": "0e08000000000001", "border_agent_id": "ba01", "red": "Casa"}
    assert any(e["what"] == "red Thread compartida con un celular" for e in hass.data[DOMAIN]["audit"].entries)
    # NEGATIVO: un usuario que no es de la casa
    otro = await hass.auth.async_create_user("Vecino")
    rt = await hass.auth.async_create_refresh_token(otro, client_id="http://x/")
    vecino = await hass_ws_client(hass, hass.auth.async_create_access_token(rt))
    await vecino.send_json({"id": 3, "type": "matterai/alta/thread_red"})
    assert not (await vecino.receive_json())["success"]
