"""Alta de dispositivos, fase 2: ambiente, nombre, resumen y la conversación con Matte de punta a punta.

La IA está simulada (un guion de respuestas): se prueba que la integración ejecute y valide lo que la IA pide,
que la app sepa cuándo esperar el equipo y que todo quede en la auditoría. Con pruebas negativas: sin clave de IA,
sin permiso, ids inventados y una IA que falla a mitad de camino.
"""

from __future__ import annotations

import json

import pytest

from homeassistant.core import Context
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er

from custom_components.matterai.alta import matte as matte_mod
from custom_components.matterai.alta.herramientas import ejecutar
from custom_components.matterai.alta.matte import es_pedido_de_alta
from custom_components.matterai.alta.ws import conversaciones
from custom_components.matterai.const import DOMAIN

from .test_alta_zigbee import IEEE, _admin, _casa, _z2m_device, rapido  # noqa: F401


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    yield


# ---------------------------------------------------------------- herramientas de ambiente y nombre
async def test_areas_asignar_y_renombrar(hass, monkeypatch) -> None:
    a, _ = await _casa(hass, "2.1.3", monkeypatch)
    user = await _admin(hass)
    cocina = ar.async_get(hass).async_get_or_create("Cocina")
    await ejecutar(hass, user, "habilitar_union", {})
    dev_id = _z2m_device(hass)
    await hass.async_block_till_done()
    found = await ejecutar(hass, user, "esperar_dispositivo_nuevo", {"timeout": 3})
    assert found["device_id"] == dev_id
    areas = await ejecutar(hass, user, "listar_areas", {})
    assert {"area_id": cocina.id, "nombre": "Cocina", "piso": None} in areas["areas"]
    out = await ejecutar(hass, user, "asignar_area", {"device_id": dev_id, "area_id": cocina.id})
    assert out["ok"] and out["area"] == "Cocina" and out["nombre_sugerido"] == "Sensor puerta Cocina"
    assert dr.async_get(hass).async_get(dev_id).area_id == cocina.id
    # un ambiente que no existía
    out = await ejecutar(hass, user, "asignar_area", {"device_id": dev_id, "area_nueva": "  Quincho "})
    assert out["area"] == "Quincho" and ar.async_get(hass).async_get_area_by_name("Quincho")
    # NEGATIVO: ambiente inventado
    bad = await ejecutar(hass, user, "asignar_area", {"device_id": dev_id, "area_id": "no-existe"})
    assert not bad["ok"] and "ambiente" in bad["error"]
    # nombre en castellano: equipo y entidades (las recién agregadas también cambian de entity_id)
    out = await ejecutar(hass, user, "renombrar", {"device_id": dev_id, "nombre": "Sensor puerta Quincho"})
    assert out["ok"]
    dev = dr.async_get(hass).async_get(dev_id)
    assert dev.name_by_user == "Sensor puerta Quincho"
    ents = {e.entity_id: e for e in er.async_entries_for_device(er.async_get(hass), dev_id)}
    assert "binary_sensor.sensor_puerta_quincho" in ents and ents["binary_sensor.sensor_puerta_quincho"].name == "Sensor puerta Quincho"
    assert "sensor.sensor_puerta_quincho_bateria" in ents and ents["sensor.sensor_puerta_quincho_bateria"].name == "Sensor puerta Quincho batería"
    # NEGATIVO: sin nombre / equipo inventado
    assert not (await ejecutar(hass, user, "renombrar", {"device_id": dev_id, "nombre": " "}))["ok"]
    assert not (await ejecutar(hass, user, "renombrar", {"device_id": "inventado", "nombre": "X"}))["ok"]
    # resumen: cierra la unión y queda en la auditoría
    out = await ejecutar(hass, user, "terminar", {})
    assert out["agregados"] == [{"device_id": dev_id, "nombre": "Sensor puerta Quincho", "tipo": found["tipo_texto"], "area": "Quincho"}]
    assert a.union is None and a.estado == "inactivo"
    whats = [e["what"] for e in hass.data[DOMAIN]["audit"].entries if e["kind"] == "alta"]
    for w in ("unión Zigbee habilitada", "dispositivo nuevo", "área asignada", "ambiente creado", "renombrado", "unión Zigbee cerrada", "alta terminada"):
        assert w in whats, w


# ---------------------------------------------------------------- Matte (IA simulada)
class _Resp:
    def __init__(self, blocks, stop="end_turn"):
        self.content = blocks
        self.stop_reason = "tool_use" if any(b["type"] == "tool_use" for b in blocks) else stop


def _use(name, args=None, i=[0]):  # noqa: B006 - contador de ids
    i[0] += 1
    return {"type": "tool_use", "id": f"tu_{i[0]}", "name": name, "input": args or {}}


def _txt(t):
    return {"type": "text", "text": t}


def _last_result(messages, name=None):
    for m in reversed(messages):
        if m["role"] == "user" and isinstance(m["content"], list):
            return json.loads(m["content"][-1]["content"])
    return {}


class FakeAI:
    """Guion: cada llamada devuelve el próximo paso (una función de los mensajes que llegaron)."""

    def __init__(self, steps):
        self.steps, self.calls = list(steps), []
        self.messages = self

    async def create(self, **kw):
        self.calls.append(kw)
        step = self.steps.pop(0)
        out = step(kw["messages"]) if callable(step) else step
        if isinstance(out, Exception):
            raise out
        return _Resp(out)


def _con_ia(hass, monkeypatch, steps):
    fake = FakeAI(steps)
    monkeypatch.setattr(matte_mod, "api_key", lambda _hass: "clave-de-prueba")
    conv = conversaciones(hass)

    async def _client(_key):
        return fake

    monkeypatch.setattr(conv, "_get_client", _client)
    return conv, fake


async def test_matte_de_punta_a_punta(hass, monkeypatch) -> None:
    a, _ = await _casa(hass, "2.1.3", monkeypatch)
    user = await _admin(hass)
    cocina = ar.async_get(hass).async_get_or_create("Cocina")
    state: dict = {}

    def found(msgs):
        r = _last_result(msgs)
        state["dev"] = r["device_id"]
        return [_txt(f"Encontré un {r['tipo_texto'].lower()} {r['marca']}. ¿Dónde lo pusiste?")]

    conv, fake = _con_ia(hass, monkeypatch, [
        [_use("detectar_coordinador")],
        [_use("habilitar_union", {"segundos": 180})],
        [_txt("Listo. Mantené apretado el botón 5 segundos hasta que titile.")],
        [_use("esperar_dispositivo_nuevo", {"timeout": 5})],
        found,
        lambda m: [_use("listar_areas")],
        lambda m: [_use("asignar_area", {"device_id": state["dev"], "area_id": cocina.id})],
        lambda m: [_txt("Lo puse en la Cocina. ¿Le pongo «Sensor puerta Cocina»?")],
        lambda m: [_use("renombrar", {"device_id": state["dev"], "nombre": "Sensor puerta Cocina"})],
        [_txt("Hecho. ¿Querés agregar otro?")],
        [_use("terminar")],
        [_txt("Quedó el Sensor puerta Cocina en la Cocina. ¡Listo!")],
    ])
    r1 = await conv.conversar(user, None, "Voy a agregar un sensor nuevo")
    assert r1["ok"] and r1["siguiente"] == "esperar" and "titile" in r1["say"] and r1["estado"]["union"]["abierta"]
    sid = r1["session_id"]
    assert "[estado: inactivo]" in fake.calls[0]["messages"][0]["content"], "Matte ve el estado del alta en cada turno"
    assert fake.calls[0]["system"][0]["cache_control"] and fake.calls[0]["tools"][-1]["cache_control"], "instrucciones y herramientas en caché"
    _z2m_device(hass)
    await hass.async_block_till_done()
    r2 = await conv.conversar(user, sid, "", "esperar")
    assert r2["siguiente"] is None and "Aqara" in r2["say"] and r2["session_id"] == sid
    r3 = await conv.conversar(user, sid, "En la cocina")
    assert "Sensor puerta Cocina" in r3["say"] and dr.async_get(hass).async_get(state["dev"]).area_id == cocina.id
    r4 = await conv.conversar(user, sid, "Dale")
    assert dr.async_get(hass).async_get(state["dev"]).name_by_user == "Sensor puerta Cocina"
    r5 = await conv.conversar(user, sid, "No, nada más")
    assert r5["fin"] and a.union is None and sid not in conv.sesiones
    assert r4["herramientas"] == ["renombrar"]


async def test_matte_sin_ia_sin_permiso_y_fallas(hass, monkeypatch) -> None:
    await _casa(hass, "2.1.3", monkeypatch)
    user = await _admin(hass)
    conv = conversaciones(hass)
    # sin clave: la app abre el asistente en pantallas
    r = await conv.conversar(user, None, "Quiero agregar un enchufe")
    assert r["ok"] and r["sin_ia"]
    # NEGATIVO: un usuario que no es de la casa
    otro = await hass.auth.async_create_user("Vecino")
    r = await conv.conversar(otro, None, "agregá un sensor")
    assert not r["ok"] and r["codigo"] == "sin_permiso"
    # NEGATIVO: la IA falla a mitad de camino → mensaje claro y la conversación sigue sana
    conv, fake = _con_ia(hass, monkeypatch, [[_use("detectar_coordinador")], RuntimeError("caída"), [_txt("¿Qué equipo vas a agregar?")]])
    r = await conv.conversar(user, None, "hola")
    assert not r["ok"] and "problema" in r["say"]
    s = conv.sesiones[r["session_id"]]
    assert s["messages"] == [], "el turno a medias se descarta"
    r = await conv.conversar(user, r["session_id"], "hola de nuevo")
    assert r["ok"] and r["say"] == "¿Qué equipo vas a agregar?"
    # NEGATIVO: otra persona no puede seguir la sesión de alguien
    conv.sesiones[r["session_id"]]["user_id"] = "otro"
    _, fake2 = _con_ia(hass, monkeypatch, [[_txt("Hola")]])
    r2 = await conv.conversar(user, r["session_id"], "sigo")
    assert r2["session_id"] != r["session_id"]


async def test_matte_por_websocket(hass, hass_ws_client, monkeypatch) -> None:
    await _casa(hass, "2.1.3", monkeypatch)
    _con_ia(hass, monkeypatch, [[_txt("¿Qué vas a agregar?")]])
    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": "matterai/alta/matte", "texto": "agregar equipo"})
    r = (await ws.receive_json())["result"]
    assert r["ok"] and r["say"] == "¿Qué vas a agregar?" and r["session_id"]
    # NEGATIVO: mensaje vacío
    await ws.send_json({"id": 2, "type": "matterai/alta/matte", "texto": "  "})
    assert not (await ws.receive_json())["success"]


# ---------------------------------------------------------------- voz
def test_frases_de_alta() -> None:
    for t in ("Voy a agregar dispositivos nuevos", "quiero sumar un sensor", "Matte, agregá un enchufe", "vincular un equipo Matter", "instalé un botón zigbee"):
        assert es_pedido_de_alta(t), t
    for t in ("prendé la luz del living", "agregá esta canción a la cola", "poné música", "apagá todo", "sumá volumen"):
        assert not es_pedido_de_alta(t), t


async def test_voz_deriva_a_matte(hass, monkeypatch) -> None:
    await _casa(hass, "2.1.3", monkeypatch)
    from custom_components.matterai.voice import VoiceBrain

    brain = VoiceBrain(hass, None, "local")
    user = await _admin(hass)
    r = await brain.async_handle("Voy a agregar dispositivos nuevos", {}, Context(user_id=user.id))
    assert r["abrir"] == "alta" and r["actions"] == []
    otro = await hass.auth.async_create_user("Vecino")
    r = await brain.async_handle("Voy a agregar dispositivos nuevos", {}, Context(user_id=otro.id))
    assert "abrir" not in r and "titular" in r["say"]
