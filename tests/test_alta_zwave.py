"""Alta de dispositivos: Z-Wave (incluir con PIN S2, QR SmartStart, excluir) y equipos locales que piden datos
(código de HomeKit, clave de ESPHome, contraseña).

El controlador Z-Wave está simulado. Con pruebas negativas: PIN mal escrito o cuando nadie lo pide, QR que no es de
Z-Wave, inclusión que falla, datos incorrectos, y el PIN / los datos que nunca quedan guardados.
"""

from __future__ import annotations

import asyncio
from datetime import timedelta
import logging

import pytest
import voluptuous as vol

from homeassistant import config_entries
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.util import dt as dt_util

from pytest_homeassistant_custom_component.common import MockConfigEntry, async_fire_time_changed, mock_config_flow

from custom_components.matterai.alta import zwave as zwave_mod
from custom_components.matterai.alta.herramientas import ejecutar
from custom_components.matterai.const import DOMAIN

from .test_alta_descubrimientos import _descubrir, shelly  # noqa: F401
from .test_alta_matte import _con_ia, _txt, _use
from .test_alta_zigbee import _admin, _casa, rapido  # noqa: F401

QR = "90" + "0" * 52


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    yield


class FakeController:
    def __init__(self):
        self.handlers: dict[str, list] = {}
        self.calls: list = []
        self.fail = False

    def on(self, name, cb):
        self.handlers.setdefault(name, []).append(cb)
        return lambda: self.handlers[name].remove(cb)

    def emit(self, name, data=None):
        for cb in list(self.handlers.get(name, [])):
            cb({"event": name, **(data or {})})

    async def async_begin_inclusion(self, strategy, **kw):
        if self.fail:
            raise RuntimeError("busy")
        self.calls.append(("incluir", strategy))
        return True

    async def async_stop_inclusion(self):
        self.calls.append(("parar",))

    async def async_stop_exclusion(self):
        self.calls.append(("parar_exclusion",))

    async def async_grant_security_classes(self, grant):
        self.calls.append(("grant", grant))

    async def async_validate_dsk_and_enter_pin(self, pin):
        self.calls.append(("pin", pin))

    async def async_provision_smart_start_node(self, info):
        self.calls.append(("qr", info))

    async def async_begin_exclusion(self, strategy=None):
        self.calls.append(("excluir",))
        return True


@pytest.fixture
def zw(monkeypatch):
    ctrl = FakeController()
    client = type("C", (), {"driver": type("D", (), {"controller": ctrl})()})()
    monkeypatch.setattr(zwave_mod, "entrada", lambda _h: object())
    monkeypatch.setattr(zwave_mod, "_client", lambda _h: client)

    async def _parse(_c, code):
        return {"dsk": "parsed"}

    monkeypatch.setattr(zwave_mod, "_parse_qr", _parse)
    return ctrl


def _zwave_device(hass):
    src = MockConfigEntry(domain="zwave_js")
    src.add_to_hass(hass)
    dev = dr.async_get(hass).async_get_or_create(config_entry_id=src.entry_id, identifiers={("zwave_js", "123-5")}, name="Door Window Sensor",
                                                 manufacturer="Aeotec", model="ZWA008")
    e = er.async_get(hass).async_get_or_create("binary_sensor", "zwave_js", "5-door", device_id=dev.id, config_entry=src, original_device_class="door")
    hass.states.async_set(e.entity_id, "off")
    return dev.id


async def test_zwave_incluir_con_pin_s2(hass, zw, monkeypatch, caplog) -> None:
    a, _ = await _casa(hass, None, monkeypatch)
    user = await _admin(hass)
    det = await ejecutar(hass, user, "detectar_coordinador", {})
    assert det["zwave"] and det["coordinadores"] == [{"id": "zwave", "tipo": "zwave", "nombre": "Z-Wave"}]
    out = await ejecutar(hass, user, "habilitar_union", {"red": "zwave", "segundos": 120})
    assert out["ok"] and out["coordinadores"] == ["Z-Wave"] and zw.calls[0][0] == "incluir"
    assert any(e["what"] == "unión Z-Wave habilitada" for e in hass.data[DOMAIN]["audit"].entries)
    # NEGATIVO: no hay Zigbee en esta casa
    assert not (await ejecutar(hass, user, "habilitar_union", {"red": "zigbee"}))["ok"]
    # S2: se conceden las clases pedidas y el equipo pide el PIN
    zw.emit("grant security classes", {"requested_grant": "S2_Authenticated"})
    await hass.async_block_till_done()
    assert ("grant", "S2_Authenticated") in zw.calls
    estados: list = []
    a.subscribe(lambda s: estados.append(s))
    zw.emit("validate dsk and enter pin", {"dsk": "-23456-34567-45678"})
    assert estados[-1]["estado"] == "pide_pin" and estados[-1]["pide_pin"] and estados[-1]["dsk"] == "-23456-34567-45678"
    # NEGATIVO: PIN mal escrito
    bad = await ejecutar(hass, user, "pin_zwave", {"pin": "123"})
    assert not bad["ok"] and "5 primeros números" in bad["error"]
    caplog.set_level(logging.DEBUG)
    assert (await ejecutar(hass, user, "pin_zwave", {"pin": "12345"}))["ok"]
    assert ("pin", "12345") in zw.calls and a.estado == "configurando"
    ours = " ".join(r.getMessage() for r in caplog.records if r.name.startswith("custom_components.matterai"))
    assert "12345" not in ours and not any("12345" in str(e) for e in hass.data[DOMAIN]["audit"].entries)
    # NEGATIVO: ya nadie pide el PIN
    assert not (await ejecutar(hass, user, "pin_zwave", {"pin": "12345"}))["ok"]
    zw.emit("node added", {"node": object()})
    dev_id = _zwave_device(hass)
    found = await ejecutar(hass, user, "esperar_dispositivo_nuevo", {"timeout": 3})
    assert found["encontrado"] and found["device_id"] == dev_id and found["origen"] == "zwave" and found["tipo"] == "puerta"
    # se para sola al vencer
    async_fire_time_changed(hass, dt_util.utcnow() + timedelta(seconds=130))
    await hass.async_block_till_done()
    assert ("parar",) in zw.calls and a.union is None


async def test_zwave_qr_excluir_y_fallas(hass, zw, monkeypatch) -> None:
    a, _ = await _casa(hass, None, monkeypatch)
    user = await _admin(hass)
    assert (await ejecutar(hass, user, "qr_zwave", {"codigo": QR}))["ok"] and ("qr", {"dsk": "parsed"}) in zw.calls
    assert any(e["what"] == "equipo Z-Wave anotado con QR" and QR not in str(e) for e in hass.data[DOMAIN]["audit"].entries)
    # NEGATIVO: un QR que no es de Z-Wave
    bad = await ejecutar(hass, user, "qr_zwave", {"codigo": "MT:Y.K9042C00KA0648G00"})
    assert not bad["ok"] and "empieza con 90" in bad["error"]
    # excluir: el cliente aprieta el botón y el equipo sale de la red anterior
    task = hass.async_create_task(ejecutar(hass, user, "excluir_zwave", {"segundos": 5}))
    await asyncio.sleep(0.05)
    zw.emit("node removed", {"node": object()})
    out = await task
    assert out["ok"] and out["excluido"] and ("parar_exclusion",) in zw.calls
    # NEGATIVO: nadie aprieta nada
    out = await ejecutar(hass, user, "excluir_zwave", {"segundos": 1})
    assert out["ok"] and not out["excluido"] and "resetea" in out["mensaje"]
    # NEGATIVO: el controlador está ocupado / la inclusión falla
    zw.fail = True
    assert not (await ejecutar(hass, user, "habilitar_union", {"red": "zwave"}))["ok"]
    zw.fail = False
    await ejecutar(hass, user, "habilitar_union", {"red": "zwave"})
    wait = hass.async_create_task(ejecutar(hass, user, "esperar_dispositivo_nuevo", {"timeout": 5}))
    await asyncio.sleep(0.05)
    zw.emit("inclusion failed")
    r = await wait
    assert not r["encontrado"] and "excluirlo" in r["mensaje"]


async def test_matte_oculta_el_pin(hass, zw, monkeypatch) -> None:
    a, _ = await _casa(hass, None, monkeypatch)
    user = await _admin(hass)
    await ejecutar(hass, user, "habilitar_union", {"red": "zwave"})
    zw.emit("validate dsk and enter pin", {"dsk": "-1"})
    conv, _fake = _con_ia(hass, monkeypatch, [[_use("pin_zwave", {"pin": "54321"})], [_txt("Listo, aceptó el PIN.")]])
    r = await conv.conversar(user, None, "el pin es 54321")
    assert r["ok"] and ("pin", "54321") in zw.calls
    assert "54321" not in str(conv.sesiones[r["session_id"]]["messages"])


class HomeKitFlow(config_entries.ConfigFlow):
    """Como HomeKit: confirmar → código de 8 números."""

    VERSION = 1

    async def async_step_zeroconf(self, info):
        await self.async_set_unique_id(info["id"])
        self.context["title_placeholders"] = {"name": info["name"]}
        return await self.async_step_pair()

    async def async_step_pair(self, user_input=None):
        errors = {}
        if user_input is not None:
            if user_input.get("pairing_code") == "111-22-333":
                return self.async_create_entry(title="Termostato", data={})
            errors["pairing_code"] = "authentication_error"
        return self.async_show_form(step_id="pair", data_schema=vol.Schema({vol.Required("pairing_code"): str}), errors=errors)


async def test_equipo_local_que_pide_datos(hass, monkeypatch, caplog) -> None:
    from pytest_homeassistant_custom_component.common import MockModule, mock_integration, mock_platform
    from unittest.mock import AsyncMock

    await _casa(hass, None, monkeypatch)
    user = await _admin(hass)
    mock_integration(hass, MockModule("test_homekit", async_setup_entry=AsyncMock(return_value=True)))
    mock_platform(hass, "test_homekit.config_flow", None)
    with mock_config_flow("test_homekit", HomeKitFlow):
        await hass.config_entries.flow.async_init("test_homekit", context={"source": config_entries.SOURCE_ZEROCONF}, data={"id": "hk1", "name": "Termostato Ecobee"})
        await hass.async_block_till_done()
        item = (await ejecutar(hass, user, "listar_descubiertos", {}))["descubiertos"][0]
        r = await ejecutar(hass, user, "agregar_descubierto", {"id": item["id"]})
        assert not r["ok"] and r["pide_datos"]
        assert r["campos"] == [{"nombre": "pairing_code", "etiqueta": "Código de HomeKit (8 números)", "tipo": "texto", "requerido": True, "secreto": True}]
        # NEGATIVO: código incorrecto → lo dice claro y se puede reintentar
        r = await ejecutar(hass, user, "agregar_descubierto", {"id": item["id"], "datos": {"pairing_code": "999-99-999"}})
        assert not r["ok"] and r["errores"] == {"pairing_code": "datos incorrectos"}
        caplog.set_level(logging.DEBUG)
        r = await ejecutar(hass, user, "agregar_descubierto", {"id": item["id"], "datos": {"pairing_code": "111-22-333"}})
        assert r["ok"] and r["agregado"]
        await hass.async_block_till_done()
        assert hass.config_entries.async_entries("test_homekit")
        ours = " ".join(r.getMessage() for r in caplog.records if r.name.startswith("custom_components.matterai"))
        assert "111-22-333" not in ours and not any("111-22-333" in str(e) for e in hass.data[DOMAIN]["audit"].entries)


async def test_shelly_con_contrasena(hass, shelly, monkeypatch) -> None:  # noqa: F811
    await _casa(hass, None, monkeypatch)
    user = await _admin(hass)
    await _descubrir(hass, "c3", "Shelly Pro", password=True)
    item = (await ejecutar(hass, user, "listar_descubiertos", {}))["descubiertos"][0]
    r = await ejecutar(hass, user, "agregar_descubierto", {"id": item["id"]})
    assert r["pide_datos"] and r["campos"][0]["etiqueta"] == "Contraseña"
    r = await ejecutar(hass, user, "agregar_descubierto", {"id": item["id"], "datos": {"password": "secreta"}})
    assert r["ok"] and r["agregado"]
