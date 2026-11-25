"""La campanita: los avisos de las automatizaciones quedan guardados, con la foto del momento y sólo para quien corresponde."""

from __future__ import annotations

import os
import time
from types import SimpleNamespace

import pytest

from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.setup import async_setup_component

from pytest_homeassistant_custom_component.common import MockConfigEntry, async_mock_service

from custom_components.matterai.asistente.reglas import compile_rule
from custom_components.matterai.avisos import MAX_AVISOS, Avisos
from custom_components.matterai.const import DOMAIN
from custom_components.matterai.escenas.const import DOMAIN as ESC

from .test_matte_etapa2 import DATA, _regla_llegadas

JPG = b"\xff\xd8\xff\xe0una-foto"
APP = "ar.com.matterai.app"


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    yield


@pytest.fixture
async def casa(hass, tmp_path, monkeypatch):
    """Sofi con celular y tablet (mismo dashboard), Tomi con otro celular, un invitado y la cámara de la entrada con su sensor."""
    hass.config.config_dir = str(tmp_path)
    await async_setup_component(hass, "http", {})
    entry = MockConfigEntry(domain=DOMAIN, data=DATA, title="MatterAI · Casa Pérez")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    rt = hass.data[DOMAIN]
    u = {}
    for n in ("sofi", "tablet", "tomi", "invitado"):
        u[n], _ = await rt["house"]._async_new_device(n, "pair", None, None, {"until": time.time() + 9999} if n == "invitado" else None)
    rt["views"].views = {"v1": {"id": "v1", "name": "Sofi"}}
    rt["views"].users = {u["sofi"]: "v1", u["tablet"]: "v1"}
    llamadas = {}
    for n in ("sofi", "tomi"):
        MockConfigEntry(domain="mobile_app", data={"app_id": APP, "device_name": n, "device_id": f"d-{n}", "user_id": u[n]}).add_to_hass(hass)
        llamadas[n] = async_mock_service(hass, "notify", f"mobile_app_{n}")
    frig = MockConfigEntry(domain="frigate")
    frig.add_to_hass(hass)
    dev = dr.async_get(hass).async_get_or_create(config_entry_id=frig.entry_id, identifiers={("frigate", "entrada")})
    reg = er.async_get(hass)
    for dom, name in (("camera", "entrada"), ("binary_sensor", "entrada_auto")):
        reg.async_get_or_create(dom, "frigate", name, suggested_object_id=name, device_id=dev.id, config_entry=frig)
        hass.states.async_set(f"{dom}.{name}", "off", {"friendly_name": name})
    fotos = []

    async def _img(_h, eid, timeout=10, **_k):
        fotos.append(eid)
        return SimpleNamespace(content=JPG, content_type="image/jpeg")

    import homeassistant.components.camera as cam

    monkeypatch.setattr(cam, "async_get_image", _img)
    return SimpleNamespace(rt=rt, av=rt["avisos"], u=u, llamadas=llamadas, fotos=fotos, manager=hass.data[ESC], entry=entry)


def _regla(foto=None, targets=("sofi",)):
    return compile_rule({"kind": "auto", "name": "Llegó un auto", "ui": {
        "triggers": [{"type": "device", "entity": "binary_sensor.entrada_auto", "to": "on"}],
        "actions": [{"type": "notify", "target": f"mobile_app_{t}", "title": "Auto", "message": "Llegó un auto", **({"foto": foto} if foto else {})} for t in targets]}})


async def _disparar(hass):
    hass.states.async_set("binary_sensor.entrada_auto", "off")
    await hass.async_block_till_done()
    hass.states.async_set("binary_sensor.entrada_auto", "on")
    await hass.async_block_till_done()


async def test_regla_de_matte_queda_con_foto_en_todos_los_equipos(hass, casa) -> None:
    await casa.manager.async_save(_regla(targets=("sofi", "sofi")), None)
    await _disparar(hass)
    [a] = casa.av.listar(casa.u["sofi"])  # dos notificaciones iguales: un solo aviso
    assert (a["titulo"], a["texto"], a["nuevo"]) == ("Auto", "Llegó un auto", True) and a["foto"]
    assert [x["id"] for x in casa.av.listar(casa.u["tablet"])] == [a["id"]]  # su otro equipo
    assert casa.av.listar(casa.u["tomi"]) == [] and casa.av.listar(casa.u["invitado"]) == []
    d = casa.llamadas["sofi"][0].data
    assert d["message"] == "Llegó un auto" and d["data"]["image"] == a["foto"] and d["data"]["clickAction"] == f"/avisos?id={a['id']}"
    assert casa.fotos == ["camera.entrada"]
    # sobrevive al reinicio, con su foto
    await casa.av.async_stop()
    otro = Avisos(hass)
    await otro.async_load()
    assert otro.listar(casa.u["sofi"])[0]["foto"] == a["foto"] and os.path.isfile(otro.ruta(a["id"]))


async def test_sin_foto_y_ordenes_al_celular(hass, casa) -> None:
    raw = _regla("no")
    raw["actions"].append({"service": "notify.mobile_app_sofi", "data": {"message": "clear_notification", "data": {"tag": "x"}}})
    await casa.manager.async_save(raw, None)
    await _disparar(hass)
    [a] = casa.av.listar(casa.u["sofi"])
    assert a["foto"] is None and casa.fotos == []
    assert "image" not in casa.llamadas["sofi"][0].data["data"] and "foto" not in casa.llamadas["sofi"][0].data["data"]
    assert casa.llamadas["sofi"][1].data["message"] == "clear_notification"


async def test_la_foto_pide_sesion_y_permiso(hass, casa, hass_client_no_auth) -> None:
    casa.av.anotar("Timbre", "Tocaron", targets=["mobile_app_sofi"], camara="camera.entrada")
    await hass.async_block_till_done()
    url = casa.av.listar(casa.u["sofi"])[0]["foto"]
    cli = await hass_client_no_auth()

    async def pedir(uid=None):
        h = {}
        if uid:
            rid = casa.rt["house"].devices[uid]["refresh_id"]
            h["Authorization"] = "Bearer " + hass.auth.async_create_access_token(hass.auth.async_get_refresh_token(rid))
        return await cli.get(url, headers=h)

    assert (await pedir()).status == 401
    assert (await pedir(casa.u["tomi"])).status == 404
    r = await pedir(casa.u["tablet"])
    assert r.status == 200 and await r.read() == JPG
    casa.rt["app_devices"].set("d-sofi", "kids", None)  # perfil sin seguridad: el aviso sí, la foto no
    assert casa.av.listar(casa.u["sofi"])[0]["foto"] is None and (await pedir(casa.u["sofi"])).status == 404


async def test_borrar_vencer_y_limite(hass, casa) -> None:
    a = casa.av.anotar("Para todos", "x", targets=None, camara="camera.entrada")
    await hass.async_block_till_done()
    ruta = casa.av.ruta(a["id"])
    assert casa.av.listar(casa.u["invitado"]) == []
    casa.av.vistos(casa.u["tablet"])
    assert not casa.av.listar(casa.u["sofi"])[0]["nuevo"] and casa.av.listar(casa.u["tomi"])[0]["nuevo"]
    assert casa.av.borrar(casa.u["invitado"], None) == 0  # no puede borrar lo que no ve
    assert casa.av.borrar(casa.u["sofi"], [a["id"]]) == 1
    assert casa.av.listar(casa.u["tablet"]) == [] and casa.av.listar(casa.u["tomi"]) and os.path.isfile(ruta)
    casa.av.borrar(casa.u["tomi"], None)
    await hass.async_block_till_done(wait_background_tasks=True)
    assert casa.av.items == [] and not os.path.isfile(ruta)
    v = casa.av.anotar("Viejo", "x", targets=["mobile_app_tomi"], camara="camera.entrada")
    await hass.async_block_till_done()
    v["t"] -= 31 * 86400
    casa.av.vencer()
    await hass.async_block_till_done()
    assert casa.av.items == [] and not os.path.isfile(casa.av.ruta(v["id"]))
    for i in range(MAX_AVISOS + 5):
        casa.av.anotar("n", str(i), targets=["mobile_app_tomi"])
    assert len(casa.av.items) == MAX_AVISOS and casa.av.items[0]["texto"] == str(MAX_AVISOS + 4)


async def test_llegadas_con_y_sin_foto(hass, casa) -> None:
    for foto, hay in ((True, True), (False, False)):
        ctl = await _regla_llegadas(hass, casa.manager, unknown_cars=True, foto=foto)
        car = {"id": "1700000000.1-abc", "camera": "entrada", "plate": None}
        ctl._cars.append(car)
        ctl._car_unknown(car)
        await hass.async_block_till_done()
        a = casa.av.listar(casa.u["tomi"])[0]  # sin celulares elegidos: para todos
        assert a["titulo"] == "🚗 Auto en la entrada" and bool(a["foto"]) is hay
        casa.av.borrar(casa.u["tomi"], None)
        casa.av.borrar(casa.u["sofi"], None)


async def test_matte_elige_la_camara(hass, casa) -> None:
    a = casa.rt["asistente"]
    raw = {"kind": "auto", "ui": {"triggers": [{"type": "device", "entity": "binary_sensor.entrada_auto", "to": "on"}], "actions": [{"type": "notify", "target": "mobile_app_sofi", "message": "x"}]}}
    assert "entrada" in a._elegir_foto(raw) and raw["ui"]["actions"][0]["foto"] == "camera.entrada"
    raw["ui"]["actions"][0]["foto"] = "no"
    assert a._elegir_foto(raw).startswith("sin foto") and raw["ui"]["actions"][0]["foto"] == "no"
    assert a._camaras()[0]["sensores"] == ["binary_sensor.entrada_auto"]
    raw["ui"]["actions"][0]["foto"] = "camera.inventada"
    with pytest.raises(ValueError):
        a._elegir_foto(raw)
