"""Alta de dispositivos, fase 4: Matter por la red (código compartido desde otra app) y verificación de Thread.

El Matter Server está simulado. Con pruebas negativas: código mal copiado o con formato inválido, Matter caído,
Thread sin border router o sin red, errores del Matter Server con mensaje claro, y el código que nunca queda
guardado (ni en la auditoría, ni en los logs, ni en la conversación con Matte).
"""

from __future__ import annotations

import logging
from types import SimpleNamespace

import pytest

from homeassistant.config_entries import ConfigEntryState
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er

from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.matterai.alta import matter as matter_mod
from custom_components.matterai.alta.core import AltaError
from custom_components.matterai.alta.herramientas import ejecutar
from custom_components.matterai.alta.matter import normalizar_codigo
from custom_components.matterai.const import DOMAIN

from .test_alta_matte import _con_ia, _txt, _use
from .test_alta_zigbee import _admin, _casa, rapido  # noqa: F401

CODE = "34970112332"  # código de prueba de Matter (pin 20202021, discriminador 3840)


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    yield


@pytest.fixture(autouse=True)
async def matter_simulado_al_final(hass):
    """La integración Matter es simulada: al cerrar la prueba no se intenta descargar (no está instalada acá)."""
    yield
    for e in hass.config_entries.async_entries("matter"):
        e.mock_state(hass, ConfigEntryState.NOT_LOADED)


def test_codigos() -> None:
    assert normalizar_codigo("3497-011-2332") == CODE and normalizar_codigo(" 3497 011 2332 ") == CODE
    assert normalizar_codigo("MT:Y.K9042C00KA0648G00") == "MT:Y.K9042C00KA0648G00"
    for bad, word in (("34970112333", "número mal"), ("1234", "11 números"), ("hola", "11 números"), ("MT:abc", "QR")):
        with pytest.raises(AltaError, match=word):
            normalizar_codigo(bad)


def _matter_entry(hass, loaded=True):
    e = MockConfigEntry(domain="matter", title="Matter")
    e.add_to_hass(hass)
    e.mock_state(hass, ConfigEntryState.LOADED if loaded else ConfigEntryState.SETUP_RETRY)
    return e


def _thread(monkeypatch, network="MatterAI-Casa", source="OpenThread Border Router", preferred=True):
    ds = SimpleNamespace(network_name=network, source=source)
    store = SimpleNamespace(preferred_dataset="ds1" if preferred else None, async_get=lambda i: ds if i == "ds1" else None)

    async def _store(_hass):
        return store

    monkeypatch.setattr(matter_mod, "_dataset_store", _store)


async def test_estado_matter_y_thread(hass, monkeypatch) -> None:
    await _casa(hass, None, monkeypatch)
    user = await _admin(hass)
    est = await ejecutar(hass, user, "estado_matter", {})
    assert not est["matter"]["ok"] and "integración Matter" in est["matter"]["mensaje"]
    assert not est["thread"]["ok"] and len(est["thread"]["faltan"]) == 2
    entry = _matter_entry(hass, loaded=False)
    assert "no está respondiendo" in (await ejecutar(hass, user, "estado_matter", {}))["matter"]["mensaje"]
    entry.mock_state(hass, ConfigEntryState.LOADED)
    _thread(monkeypatch)
    est = await ejecutar(hass, user, "estado_matter", {})
    assert est["matter"]["ok"] and est["thread"]["ok"] and est["thread"]["red"] == "MatterAI-Casa" and est["thread"]["border_router"] == "el de Home Assistant"
    _thread(monkeypatch, source="Google")
    assert (await ejecutar(hass, user, "estado_matter", {}))["thread"]["border_router"] == "Google"
    # NEGATIVO: sin red preferida → explica qué falta (y preparar_matter para Thread no arranca)
    _thread(monkeypatch, preferred=False)
    est = await ejecutar(hass, user, "estado_matter", {})
    assert not est["thread"]["ok"] and "red Thread preferida" in est["thread"]["mensaje"]
    r = await ejecutar(hass, user, "preparar_matter", {"thread": True})
    assert not r["ok"] and "red Thread" in r["error"]
    assert (await ejecutar(hass, user, "preparar_matter", {"thread": False}))["listo"], "un Matter por wifi no necesita Thread"


class FakeMatter:
    def __init__(self, hass, error=None):
        self.hass, self.error, self.calls = hass, error, []

    async def commission_with_code(self, code, network_only=True):
        self.calls.append((code, network_only))
        if self.error:
            raise self.error
        src = self.hass.config_entries.async_entries("matter")[0]
        dev = dr.async_get(self.hass).async_get_or_create(config_entry_id=src.entry_id, identifiers={("matter", "deviceid_X-1")},
                                                         name="Smart Plug", manufacturer="Eve Systems", model="Eve Energy")
        reg = er.async_get(self.hass)
        for dom, dc, obj in (("switch", "outlet", "enchufe"), ("sensor", "power", "potencia")):
            e = reg.async_get_or_create(dom, "matter", f"m-{obj}", suggested_object_id=f"eve_{obj}", device_id=dev.id, config_entry=src, original_device_class=dc)
            self.hass.states.async_set(e.entity_id, "on")
        return SimpleNamespace(node_id=7)


def _fake(monkeypatch, hass, error=None):
    fake = FakeMatter(hass, error)
    monkeypatch.setattr(matter_mod, "_cliente", lambda _hass: fake)
    return fake


async def test_comisionar_por_red(hass, monkeypatch, caplog) -> None:
    await _casa(hass, None, monkeypatch)
    user = await _admin(hass)
    _matter_entry(hass)
    fake = _fake(monkeypatch, hass)
    r = await ejecutar(hass, user, "comisionar_matter", {"codigo": "3497-011-2332"})
    assert r["ok"] and r["node_id"] == 7 and fake.calls == [(CODE, True)], "por la red, sin Bluetooth"
    found = await ejecutar(hass, user, "esperar_dispositivo_nuevo", {"timeout": 3})
    assert found["encontrado"] and found["origen"] == "matter" and found["tipo_texto"] == "Enchufe con medición de consumo"
    assert [f["id"] for f in found["funciones"]] == ["enchufe", "medicion"], "todas las funciones del equipo"
    audit = hass.data[DOMAIN]["audit"].entries
    assert any(e["what"] == "equipo Matter sumado por la red" for e in audit)
    # NEGATIVO: errores del Matter Server con mensaje claro y sin el código en ningún lado
    caplog.set_level(logging.DEBUG)
    for err, word in ((TimeoutError(), "no respondió"), (Exception(f"Commission failed: device already on fabric ({CODE})"), "resetearlo de fábrica"),
                      (Exception("NodeNotFound: discover failed"), "mismo wifi"), (RuntimeError("boom"), "código nuevo")):
        _fake(monkeypatch, hass, err)
        r = await ejecutar(hass, user, "comisionar_matter", {"codigo": CODE})
        assert not r["ok"] and word in r["error"] and CODE not in r["error"], (err, r)
    assert CODE not in caplog.text and "3497-011-2332" not in caplog.text, "el código nunca va a los logs"
    assert not any(CODE in str(e) for e in hass.data[DOMAIN]["audit"].entries)
    # NEGATIVO: código mal copiado no llega al Matter Server; Matter caído
    fake = _fake(monkeypatch, hass)
    assert not (await ejecutar(hass, user, "comisionar_matter", {"codigo": "34970112333"}))["ok"] and not fake.calls
    hass.config_entries.async_entries("matter")[0].mock_state(hass, ConfigEntryState.SETUP_RETRY)
    r = await ejecutar(hass, user, "comisionar_matter", {"codigo": CODE})
    assert not r["ok"] and not fake.calls


async def test_matte_no_guarda_el_codigo(hass, monkeypatch) -> None:
    await _casa(hass, None, monkeypatch)
    user = await _admin(hass)
    _matter_entry(hass)
    _fake(monkeypatch, hass)
    conv, fake = _con_ia(hass, monkeypatch, [
        [_use("comisionar_matter", {"codigo": "3497-011-2332"})],
        [_use("esperar_dispositivo_nuevo", {"timeout": 3})],
        [_txt("¡Listo! Se sumó un enchufe Eve. ¿Dónde lo pusiste?")],
    ])
    r = await conv.conversar(user, None, "El código que me dio Apple es 3497-011-2332")
    assert r["ok"] and "Eve" in r["say"] and r["herramientas"] == ["comisionar_matter", "esperar_dispositivo_nuevo"]
    texto = str(conv.sesiones[r["session_id"]]["messages"])
    assert CODE not in texto and "3497-011-2332" not in texto and "(código oculto)" in texto and "(oculto)" in texto
