"""Alta de dispositivos, fase 1: coordinadores Zigbee, unión con vencimiento, detección del equipo nuevo y qué es.

Los eventos de Zigbee2MQTT y del registro de HA son simulados (no hay coordinador real). Con pruebas negativas:
sin coordinador, Zigbee2MQTT que rechaza, equipo que falla al configurarse, celulares que no son equipos de la casa
y usuarios sin permiso.
"""

from __future__ import annotations

from datetime import timedelta
import json

import pytest

from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.entity import EntityCategory
from homeassistant.util import dt as dt_util

from pytest_homeassistant_custom_component.common import MockConfigEntry, async_fire_time_changed

from custom_components.matterai.alta import core
from custom_components.matterai.alta.capacidades import nombre_sugerido, normalizar
from custom_components.matterai.alta.core import permit_payload
from custom_components.matterai.alta.herramientas import ejecutar
from custom_components.matterai.const import DOMAIN

from .test_seguridad import _link, _pair, _setup, decode

IEEE = "0x00158d0001a2b3c4"


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    yield


@pytest.fixture(autouse=True)
def rapido(monkeypatch):
    """Los tiempos de espera, cortos (en la casa son segundos)."""
    monkeypatch.setattr(core, "SETTLE", 0.05)
    monkeypatch.setattr(core, "POLL", 0.01)
    monkeypatch.setattr(core, "MAX_SETTLE", 1.0)
    monkeypatch.setattr(core, "RESP_TIMEOUT", 0.2)


class Broker:
    """Zigbee2MQTT simulado: guarda lo publicado y contesta el permit_join."""

    def __init__(self, alta, status="ok", error=None):
        self.alta, self.status, self.error, self.sent = alta, status, error, []

    async def publish(self, topic, payload):
        body = json.loads(payload)
        self.sent.append((topic, body))
        if topic.endswith("/bridge/request/permit_join") and self.status:
            base = topic.split("/bridge/")[0]
            self.alta.on_mqtt(f"{base}/bridge/response/permit_join", json.dumps({"status": self.status, "error": self.error, "transaction": body["transaction"]}))


async def _casa(hass, z2m_version="2.1.3", monkeypatch=None):
    await _setup(hass)
    a = hass.data[DOMAIN]["alta"]
    if z2m_version:
        a.on_mqtt("zigbee2mqtt/bridge/state", "online")
        a.on_mqtt("zigbee2mqtt/bridge/info", json.dumps({"version": z2m_version, "permit_join": False}))
    b = Broker(a)
    monkeypatch.setattr(a, "_publish", b.publish)
    return a, b


async def _admin(hass):
    for u in await hass.auth.async_get_users():
        if u.is_admin and not u.system_generated:
            return u
    return await hass.auth.async_create_user("Instalador", group_ids=["system-admin"])


def _z2m_device(hass, ieee=IEEE, entities=(("binary_sensor", "door", "contacto"), ("sensor", "battery", "bateria"))):
    src = MockConfigEntry(domain="mqtt", title="MQTT")
    src.add_to_hass(hass)
    dev = dr.async_get(hass).async_get_or_create(config_entry_id=src.entry_id, identifiers={("mqtt", f"zigbee2mqtt_{ieee}")},
                                                 name=ieee, manufacturer="Aqara", model="MCCGQ11LM")
    reg = er.async_get(hass)
    for dom, dc, obj in entities:
        e = reg.async_get_or_create(dom, "mqtt", f"{ieee}-{obj}", suggested_object_id=f"{ieee}_{obj}", device_id=dev.id, config_entry=src,
                                    original_device_class=dc, entity_category=EntityCategory.DIAGNOSTIC if dc == "battery" else None)
        hass.states.async_set(e.entity_id, "off")
    return dev.id


def _zha(hass, calls):
    MockConfigEntry(domain="zha", title="ZHA").add_to_hass(hass)

    async def permit(call):
        calls.append(dict(call.data))

    hass.services.async_register("zha", "permit", permit)


# ---------------------------------------------------------------- coordinadores
async def test_detectar_coordinador(hass, monkeypatch) -> None:
    a, _ = await _casa(hass, None, monkeypatch)
    assert a.detectar_coordinador()["tipo"] == "ninguno"
    a.on_mqtt("zigbee2mqtt/bridge/info", json.dumps({"version": "1.40.2"}))
    det = a.detectar_coordinador()
    assert det["tipo"] == "z2m" and det["coordinadores"][0]["version"] == "1.40.2" and det["coordinadores"][0]["base"] == "zigbee2mqtt"
    calls: list = []
    _zha(hass, calls)
    assert a.detectar_coordinador()["tipo"] == "ambos"
    # NEGATIVO: un Zigbee2MQTT apagado no cuenta
    a.on_mqtt("zigbee2mqtt/bridge/state", json.dumps({"state": "offline"}))
    assert a.detectar_coordinador()["tipo"] == "zha"


def test_payload_segun_version() -> None:
    assert permit_payload("2.1.3", 180) == {"time": 180}
    assert permit_payload("2.0.0", 0) == {"time": 0}
    assert permit_payload("1.40.2", 120) == {"value": True, "time": 120}
    assert permit_payload("1.40.2", 0) == {"value": False}
    assert permit_payload(None, 60) == {"value": True, "time": 60}, "sin versión: las dos claves (cada versión lee la suya)"


# ---------------------------------------------------------------- unión
async def test_union_z2m_con_vencimiento_y_auditoria(hass, monkeypatch) -> None:
    a, b = await _casa(hass, "2.1.3", monkeypatch)
    user = await _admin(hass)
    out = await ejecutar(hass, user, "habilitar_union", {"segundos": 999})
    assert out["ok"] and out["segundos"] == 254, "nunca más de 254 s"
    topic, body = b.sent[-1]
    assert topic == "zigbee2mqtt/bridge/request/permit_join" and body["time"] == 254 and "value" not in body
    assert a.snapshot()["union"]["abierta"] and a.estado == "esperando"
    audit = hass.data[DOMAIN]["audit"]
    assert any(e["kind"] == "alta" and e["what"] == "unión Zigbee habilitada" and e["detail"] == "254 s" for e in audit.entries)
    # se cierra sola al vencer
    async_fire_time_changed(hass, dt_util.utcnow() + timedelta(seconds=260))
    await hass.async_block_till_done()
    assert a.union is None and b.sent[-1][1]["time"] == 0
    assert any(e["what"] == "unión Zigbee cerrada" and e["detail"] == "venció el tiempo" for e in audit.entries)


async def test_union_z2m_1x_y_cerrar_a_mano(hass, monkeypatch) -> None:
    a, b = await _casa(hass, "1.40.2", monkeypatch)
    user = await _admin(hass)
    assert (await ejecutar(hass, user, "habilitar_union", {}))["segundos"] == 180, "por defecto 180 s"
    assert b.sent[-1][1]["value"] is True and b.sent[-1][1]["time"] == 180
    assert (await ejecutar(hass, user, "deshabilitar_union", {}))["ok"]
    assert b.sent[-1][1]["value"] is False and a.union is None and a.estado == "inactivo"


async def test_union_z2m_rechazada(hass, monkeypatch) -> None:
    a, b = await _casa(hass, "2.1.3", monkeypatch)
    b.status, b.error = "error", "Coordinator busy"
    out = await ejecutar(hass, await _admin(hass), "habilitar_union", {"segundos": 60})
    assert not out["ok"] and "Coordinator busy" in out["error"] and a.union is None


async def test_union_sin_coordinador(hass, monkeypatch) -> None:
    await _casa(hass, None, monkeypatch)
    out = await ejecutar(hass, await _admin(hass), "habilitar_union", {})
    assert not out["ok"] and "coordinador" in out["error"]


async def test_union_zha(hass, monkeypatch) -> None:
    a, _ = await _casa(hass, None, monkeypatch)
    calls: list = []
    _zha(hass, calls)
    user = await _admin(hass)
    assert (await ejecutar(hass, user, "habilitar_union", {"segundos": 90}))["coordinadores"] == ["ZHA"]
    await ejecutar(hass, user, "deshabilitar_union", {})
    assert calls == [{"duration": 90}, {"duration": 0}]


# ---------------------------------------------------------------- detección
async def test_z2m_equipo_nuevo_de_punta_a_punta(hass, monkeypatch) -> None:
    a, _ = await _casa(hass, "2.1.3", monkeypatch)
    user = await _admin(hass)
    await ejecutar(hass, user, "habilitar_union", {"segundos": 120})
    estados: list = []
    a.subscribe(lambda s: estados.append(s["estado"]))
    wait = hass.async_create_task(ejecutar(hass, user, "esperar_dispositivo_nuevo", {"timeout": 5}))
    a.on_mqtt("zigbee2mqtt/bridge/event", json.dumps({"type": "device_joined", "data": {"friendly_name": IEEE, "ieee_address": IEEE}}))
    a.on_mqtt("zigbee2mqtt/bridge/event", json.dumps({"type": "device_interview", "data": {
        "friendly_name": IEEE, "ieee_address": IEEE, "status": "successful", "supported": True,
        "definition": {"vendor": "Aqara", "model": "MCCGQ11LM", "description": "Door and window contact sensor",
                       "exposes": [{"type": "binary", "name": "contact"}, {"type": "numeric", "name": "battery"}]}}}))
    dev_id = _z2m_device(hass)
    out = await wait
    assert out["ok"] and out["encontrado"] and out["device_id"] == dev_id
    assert out["tipo"] == "puerta" and out["tipo_texto"].startswith("Sensor de apertura")
    assert out["marca"] == "Aqara" and out["modelo"] == "MCCGQ11LM" and out["origen"] == "z2m" and out["ieee"] == IEEE
    assert [f["id"] for f in out["funciones"]] == ["puerta", "bateria"]
    assert "uniendo" in estados and "configurando" in estados and estados[-1] == "encontrado"
    assert any(e["what"] == "dispositivo nuevo" and "Aqara" in e["detail"] for e in hass.data[DOMAIN]["audit"].entries)
    cap = await ejecutar(hass, user, "capacidades", {"device_id": dev_id})
    assert cap["ok"] and cap["tipo"] == "puerta"


async def test_equipo_que_aparecio_antes_de_esperar_no_se_pierde(hass, monkeypatch) -> None:
    a, _ = await _casa(hass, None, monkeypatch)
    calls: list = []
    _zha(hass, calls)
    user = await _admin(hass)
    await ejecutar(hass, user, "habilitar_union", {})
    src = MockConfigEntry(domain="zha")
    src.add_to_hass(hass)
    dev = dr.async_get(hass).async_get_or_create(config_entry_id=src.entry_id, identifiers={("zha", "00:11:22:33:44:55:66:77")}, name="TS011F", manufacturer="_TZ3000", model="TS011F")
    reg = er.async_get(hass)
    for dom, dc, obj in (("switch", None, "sw"), ("sensor", "power", "w"), ("sensor", "energy", "kwh")):
        e = reg.async_get_or_create(dom, "zha", f"z-{obj}", suggested_object_id=f"enchufe_{obj}", device_id=dev.id, config_entry=src, original_device_class=dc)
        hass.states.async_set(e.entity_id, "on")
    await hass.async_block_till_done()
    out = await ejecutar(hass, user, "esperar_dispositivo_nuevo", {"timeout": 3})
    assert out["encontrado"] and out["origen"] == "zha" and out["tipo"] == "enchufe" and out["tipo_texto"] == "Enchufe con medición de consumo"
    assert out["ieee"] == "00:11:22:33:44:55:66:77"


async def test_falla_al_configurarse_y_tiempo_agotado(hass, monkeypatch) -> None:
    a, _ = await _casa(hass, "2.1.3", monkeypatch)
    user = await _admin(hass)
    await ejecutar(hass, user, "habilitar_union", {})
    wait = hass.async_create_task(ejecutar(hass, user, "esperar_dispositivo_nuevo", {"timeout": 5}))
    a.on_mqtt("zigbee2mqtt/bridge/event", json.dumps({"type": "device_joined", "data": {"friendly_name": "x", "ieee_address": IEEE}}))
    a.on_mqtt("zigbee2mqtt/bridge/event", json.dumps({"type": "device_interview", "data": {"friendly_name": "x", "ieee_address": IEEE, "status": "failed"}}))
    out = await wait
    assert out["ok"] and not out["encontrado"] and out["error"] == "configuracion" and "Resetealo" in out["mensaje"]
    # NEGATIVO: nada aparece → avisa que no hubo nada
    out = await ejecutar(hass, user, "esperar_dispositivo_nuevo", {"timeout": 1})
    assert not out["encontrado"] and out["error"] == "tiempo"


async def test_celulares_y_servicios_no_son_equipos_nuevos(hass, monkeypatch) -> None:
    a, _ = await _casa(hass, None, monkeypatch)
    a.iniciar()
    src = MockConfigEntry(domain="mobile_app", data={"app_id": "ar.com.matterai.app"})
    src.add_to_hass(hass)
    dev = dr.async_get(hass).async_get_or_create(config_entry_id=src.entry_id, identifiers={("mobile_app", "cel")}, name="Celular")
    er.async_get(hass).async_get_or_create("sensor", "mobile_app", "cel-bat", device_id=dev.id, config_entry=src, original_device_class="battery")
    await hass.async_block_till_done()
    out = await ejecutar(hass, await _admin(hass), "esperar_dispositivo_nuevo", {"timeout": 1})
    assert not out["encontrado"]


# ---------------------------------------------------------------- qué es
def _row(eid, dc=None, attrs=None, tecnica=False):
    return {"entity_id": eid, "device_class": dc, "attrs": attrs or {}, "tecnica": tecnica}


def test_capacidades_normalizadas() -> None:
    luz = normalizar([_row("light.x", attrs={"supported_color_modes": ["color_temp", "xy"]})])
    assert luz["tipo"] == "luz" and luz["tipo_texto"] == "Luz regulable de colores"
    th = normalizar([_row("sensor.t", "temperature"), _row("sensor.h", "humidity"), _row("sensor.b", "battery", tecnica=True)])
    assert th["tipo_texto"] == "Sensor de temperatura y humedad" and [f["id"] for f in th["funciones"]] == ["temperatura", "humedad", "bateria"]
    boton = normalizar([_row("event.boton_action"), _row("sensor.boton_linkquality", tecnica=True)])
    assert boton["tipo"] == "boton" and boton["entidades"]["boton"] == ["event.boton_action"]
    mov = normalizar([_row("binary_sensor.m", "motion"), _row("sensor.l", "illuminance")])
    assert mov["tipo_texto"] == "Sensor de movimiento y luz"
    # Zigbee2MQTT antes de que estén las entidades: con exposes
    z = normalizar([], [{"type": "switch", "features": [{"name": "state"}]}, {"type": "numeric", "name": "power"}])
    assert z["tipo"] == "enchufe"
    # NEGATIVO: lo técnico no define el tipo
    assert normalizar([_row("sensor.rssi", "signal_strength", tecnica=True)])["tipo"] == "desconocido"
    assert nombre_sugerido("puerta", "Cocina") == "Sensor puerta Cocina"


# ---------------------------------------------------------------- permisos (WebSocket)
async def test_permisos_y_cierre_si_se_corta(hass, hass_ws_client, hass_client_no_auth, monkeypatch) -> None:
    a, b = await _casa(hass, "2.1.3", monkeypatch)
    house = hass.data[DOMAIN]["house"]
    ws = await hass_ws_client(hass)
    code = decode((await _link(ws))["code"])["c"]
    _, body = await _pair(await hass_client_no_auth(), code)
    token = body["token"]
    cel = await hass_ws_client(hass, token)
    await cel.send_json({"id": 1, "type": "matterai/alta/permiso"})
    assert (await cel.receive_json())["result"]["permitido"], "un celular de la casa con perfil completo es el titular"
    # NEGATIVO: perfil «Sin seguridad» o invitado → sin permiso
    house.devices[body["user_id"]]["profile"] = "kids"
    await cel.send_json({"id": 2, "type": "matterai/alta/tool", "herramienta": "habilitar_union", "args": {}})
    r = await cel.receive_json()
    assert not r["success"] and r["error"]["code"] == "unauthorized" and a.union is None
    house.devices[body["user_id"]].pop("profile")
    house.devices[body["user_id"]]["until"] = 9999999999
    await cel.send_json({"id": 3, "type": "matterai/alta/subscribe"})
    assert not (await cel.receive_json())["success"]
    house.devices[body["user_id"]].pop("until")
    # NEGATIVO: herramienta inventada
    await cel.send_json({"id": 4, "type": "matterai/alta/tool", "herramienta": "borrar_todo", "args": {}})
    assert not (await cel.receive_json())["result"]["ok"]
    # el instalador abre la unión desde el panel y se le corta la conexión → se cierra sola
    await ws.send_json({"id": 5, "type": "matterai/alta/tool", "herramienta": "habilitar_union", "args": {"segundos": 100}})
    assert (await ws.receive_json())["result"]["ok"] and a.union
    await ws.close()
    await hass.async_block_till_done()
    assert a.union is None and b.sent[-1][1]["time"] == 0
    assert any(e["detail"] == "se cortó la sesión" for e in hass.data[DOMAIN]["audit"].entries)
