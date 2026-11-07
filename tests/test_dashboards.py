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
    assert views.users[gian["user_id"]] == v["id"], "se le asigna su dashboard personal (a su equipo vinculado)"
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


# ---------------------------------------------------------------- editor de tarjetas (2.13)
BLOCKS = [
    {"id": "k1", "type": "kpis", "cfg": {"items": [{"kind": "alarm"}, {"kind": "entity", "entity": "cover.porton"}, {"kind": "lights"}]}},
    {"id": "f1", "type": "featured", "title": "Garage", "cfg": {"entity": "camera.garage", "gate": "cover.porton"}},
    {"id": "r1", "type": "rooms", "title": "Lo tuyo", "cfg": {"rooms": ["Garage", "Dormitorio"]}},
    {"id": "b1", "type": "buttons", "title": "Accesos", "cfg": {"items": [
        {"name": "Portón quincho", "icon": "gate", "entity": "cover.porton_quincho", "tap": {"type": "toggle"}},
        {"name": "Agenda", "icon": "cal", "tap": {"type": "screen", "screen": "agenda"}},
        {"name": "Riego", "icon": "tree", "tap": {"type": "service", "service": "script.turn_on", "data": {"entity_id": "script.riego"}}, "hold": {"type": "more_info", "entity": "switch.riego"}},
    ]}},
    {"id": "p1", "type": "plan", "col": 0},
]
PLAN = {"image": "/api/matterai/media/0123456789abcdef.jpg", "image_on": "/api/matterai/media/fedcba9876543210.png",
        "zones": [{"name": "Estar", "room": "Living", "lights": ["light.estar"], "poly": [[0.1, 0.1], [0.4, 0.1], [0.4, 0.3]]}]}


async def test_blocks_and_plan_saved(hass, hass_ws_client) -> None:
    await _setup(hass)
    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": "matterai/views/save", "view": {"name": "Tablet living", "kind": "tablet", "orientation": "landscape", "blocks": BLOCKS, "plan": PLAN}})
    msg = await ws.receive_json()
    assert msg["success"], msg
    v = msg["result"]
    assert [b["type"] for b in v["blocks"]] == ["kpis", "featured", "rooms", "buttons", "plan"] and v["orientation"] == "landscape"
    assert v["blocks"][3]["cfg"]["items"][2]["hold"]["entity"] == "switch.riego" and v["plan"]["zones"][0]["poly"][2] == [0.4, 0.3]


@pytest.mark.parametrize("bad", [
    {"blocks": [{"id": "x", "type": "inventada"}]},                                                # tipo desconocido
    {"blocks": [{"id": "x", "type": "buttons", "cfg": {"items": [{"tap": {"type": "borrar_todo"}}]}}]},  # acción desconocida
    {"blocks": [{"id": "x", "type": "buttons", "cfg": {"items": [{"tap": {"type": "service", "service": "rm -rf"}}]}}]},
    {"blocks": [{"id": "x", "type": "buttons", "cfg": {"items": [{"tap": {"type": "screen", "screen": "http://malo"}}]}}]},
    {"blocks": [{"id": "x", "type": "kpis"}, {"id": "x", "type": "rooms"}]},                       # ids repetidos
    {"blocks": [{"id": "../x", "type": "kpis"}]},
    {"plan": {"image": "https://malo.example/x.jpg"}},                                              # imagen de afuera
    {"plan": {"image": "/api/matterai/media/../../secrets.yaml"}},
    {"plan": {"zones": [{"name": "Z", "poly": [[0, 0], [2, 2], [0, 1]]}]}},                         # punto fuera de la imagen
    {"blocks": [{"id": f"b{i}", "type": "kpis"} for i in range(40)]},                               # demasiadas
])
async def test_invalid_dashboards_rejected(hass, hass_ws_client, bad) -> None:
    await _setup(hass)
    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": "matterai/views/save", "view": {"name": "X", **bad}})
    assert not (await ws.receive_json())["success"]  # NEGATIVO


async def test_pin_from_app_updates_rooms_card(hass, hass_ws_client, hass_client_no_auth) -> None:
    await _setup(hass)
    ws = await hass_ws_client(hass)
    client = await hass_client_no_auth()
    gian = await _phone(hass, hass_ws_client, client, "Celu Gianfranco", "dev-g")
    await ws.send_json({"id": 1, "type": "matterai/views/save", "view": {"name": "G", "blocks": BLOCKS}})
    v = (await ws.receive_json())["result"]
    await ws.send_json({"id": 2, "type": "matterai/views/assign", "device_id": "dev-g", "view_id": v["id"]})
    await ws.receive_json()
    msg = await _ws(hass_ws_client, hass, gian["token"], 3, {"type": "matterai/app/view_pin", "device_id": "dev-g", "pinned": ["Dormitorio", "Garage", "Baño"]})
    assert msg["success"], msg
    rb = next(b for b in msg["result"]["blocks"] if b["type"] == "rooms")
    assert rb["cfg"]["rooms"] == ["Dormitorio", "Garage", "Baño"], "lo que fija desde la app cambia la tarjeta de ambientes"
    assert len(msg["result"]["blocks"]) == len(BLOCKS), "el resto de las tarjetas queda igual"


# ---------------------------------------------------------------- imágenes
JPG = b"\xff\xd8\xff\xe0" + b"0" * 200
PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 200


async def test_media_upload_and_private_access(hass, hass_client, hass_client_no_auth, hass_ws_client, hass_read_only_access_token) -> None:
    import aiohttp  # noqa: PLC0415

    await _setup(hass)
    admin = await hass_client()

    def form(data, name="render.jpg"):
        f = aiohttp.FormData()
        f.add_field("file", data, filename=name, content_type="image/jpeg")
        return f

    r = await admin.post("/api/matterai/media", data=form(JPG))
    body = await r.json()
    assert r.status == 200 and body["ok"] and body["path"].endswith(".jpg"), body
    path = body["path"]
    r = await admin.post("/api/matterai/media", data=form(PNG, "x.png"))
    assert (await r.json())["path"].endswith(".png"), "el tipo sale del contenido, no del nombre"
    r = await admin.post("/api/matterai/media", data=form(b"<script>alert(1)</script>", "x.jpg"))
    assert r.status == 415  # NEGATIVO: no es una imagen aunque se llame .jpg
    anon = await hass_client_no_auth()
    r = await anon.post("/api/matterai/media", data=form(JPG))
    assert r.status == 401  # NEGATIVO: sin usuario no se sube nada
    user = await hass_client_no_auth()
    r = await user.post("/api/matterai/media", data=form(JPG), headers={"Authorization": f"Bearer {hass_read_only_access_token}"})
    assert r.status == 403  # NEGATIVO: un usuario común (o la app) no sube imágenes

    r = await admin.get(path)
    assert r.status == 200 and (await r.read()) == JPG
    r = await anon.get(path)
    assert r.status == 401  # NEGATIVO: no son públicas
    r = await admin.get("/api/matterai/media/..%2F..%2Fsecrets.yaml")
    assert r.status in (400, 404)  # NEGATIVO: nada de rutas raras (HA ya lo frena con 400)
    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": "auth/sign_path", "path": path, "expires": 60})
    signed = (await ws.receive_json())["result"]["path"]
    r = await anon.get(signed)
    assert r.status == 200, "con el link firmado (lo que usa la app en <img>) se ve"

    await ws.send_json({"id": 2, "type": "matterai/media/list"})
    assert any(m["path"] == path for m in (await ws.receive_json())["result"]["media"])
    await ws.send_json({"id": 3, "type": "matterai/media/delete", "path": path})
    assert (await ws.receive_json())["success"]
    r = await admin.get(path)
    assert r.status == 404


async def test_prearmado_from_app_engine_is_valid(hass, hass_ws_client) -> None:
    """El prearmado que arma el motor de la app (vista.js) lo acepta la casa tal cual (celular y tablet)."""
    import json as _json  # noqa: PLC0415
    import pathlib  # noqa: PLC0415

    pre = _json.loads((pathlib.Path(__file__).parent / "fixtures" / "prearmado.json").read_text(encoding="utf-8"))
    await _setup(hass)
    ws = await hass_ws_client(hass)
    for i, (kind, view) in enumerate(pre.items()):
        await ws.send_json({"id": i + 1, "type": "matterai/views/save", "view": view})
        msg = await ws.receive_json()
        assert msg["success"], (kind, msg)
        assert msg["result"]["kind"] == kind and len(msg["result"]["blocks"]) == len(view["blocks"])


# ---------------------------------------------------------------- un dashboard, dos diseños (2.14)
PHONE = [{"id": "k", "type": "kpis", "cfg": {"auto": True}}, {"id": "r", "type": "rooms", "cfg": {"rooms": ["Garage"]}}]
TABLET = [{"id": "p", "type": "plan", "col": 0}, {"id": "r", "type": "rooms", "col": 2, "cfg": {"rooms": ["Garage"]}}]


async def test_one_dashboard_two_layouts(hass, hass_ws_client, hass_client_no_auth) -> None:
    await _setup(hass)
    ws = await hass_ws_client(hass)
    client = await hass_client_no_auth()
    gian = await _phone(hass, hass_ws_client, client, "Celu Gianfranco", "dev-g")
    await ws.send_json({"id": 1, "type": "matterai/views/save", "view": {"name": "Gianfranco", "kind": "phone",
                        "layouts": {"phone": {"blocks": PHONE}, "tablet": {"blocks": TABLET, "orientation": "portrait"}}}})
    v = (await ws.receive_json())["result"]
    await ws.send_json({"id": 2, "type": "matterai/views/assign_user", "user_id": gian["user_id"], "view_id": v["id"]})
    assert (await ws.receive_json())["success"]
    tab = await _ws(hass_ws_client, hass, gian["token"], 3, {"type": "matterai/app/view", "device_id": "dev-g", "kind": "tablet"})
    assert tab["result"]["view"]["kind"] == "tablet" and tab["result"]["view"]["blocks"][0]["type"] == "plan" and tab["result"]["view"]["orientation"] == "portrait"
    assert "layouts" not in tab["result"]["view"], "al equipo le llega sólo su diseño"
    cel = await _ws(hass_ws_client, hass, gian["token"], 4, {"type": "matterai/app/view", "device_id": "dev-g", "kind": "phone"})
    assert cel["result"]["view"]["blocks"][0]["type"] == "kpis"
    old = await _ws(hass_ws_client, hass, gian["token"], 5, {"type": "matterai/app/view", "device_id": "dev-g"})
    assert old["result"]["view"]["blocks"][0]["type"] == "kpis", "la app 1.6 (sin «kind») recibe el diseño del tipo del dashboard"
    # fijar desde la app cambia la tarjeta de ambientes de los dos diseños
    msg = await _ws(hass_ws_client, hass, gian["token"], 6, {"type": "matterai/app/view_pin", "device_id": "dev-g", "pinned": ["Dormitorio", "Garage"]})
    assert msg["success"], msg
    lay = hass.data[DOMAIN]["views"].views[v["id"]]["layouts"]
    assert all(next(b for b in lay[k]["blocks"] if b["type"] == "rooms")["cfg"]["rooms"] == ["Dormitorio", "Garage"] for k in ("phone", "tablet"))


async def test_assign_to_linked_equipo_without_mobile_app(hass, hass_ws_client, hass_client_no_auth) -> None:
    """Un celular vinculado que todavía no se registró en mobile_app igual aparece y se le asigna dashboard."""
    await _setup(hass)
    ws = await hass_ws_client(hass)
    client = await hass_client_no_auth()
    _, p = await _pair(client, decode((await _link(await hass_ws_client(hass)))["code"])["c"], "Celu Ana")
    await ws.send_json({"id": 1, "type": "matterai/views/save", "view": {"name": "Ana", "layouts": {"phone": {"blocks": PHONE}}}})
    v = (await ws.receive_json())["result"]
    await ws.send_json({"id": 2, "type": "matterai/views/list"})
    people = (await ws.receive_json())["result"]["people"]
    assert [x["name"] for x in people] == ["Celu Ana"] and people[0]["view"] is None
    await ws.send_json({"id": 3, "type": "matterai/views/assign_user", "user_id": p["user_id"], "view_id": v["id"]})
    assert (await ws.receive_json())["success"]
    msg = await _ws(hass_ws_client, hass, p["token"], 4, {"type": "matterai/app/view", "device_id": "cualquiera", "kind": "phone"})
    assert msg["result"]["view"]["name"] == "Ana" and msg["result"]["personal"] is True
    # NEGATIVO: el celular no se asigna dashboards; ni a un usuario que no es un equipo de la casa
    msg = await _ws(hass_ws_client, hass, p["token"], 5, {"type": "matterai/views/assign_user", "user_id": p["user_id"], "view_id": None})
    assert not msg["success"] and msg["error"]["code"] == "unauthorized"
    await ws.send_json({"id": 6, "type": "matterai/views/assign_user", "user_id": "no-existe", "view_id": v["id"]})
    assert (await ws.receive_json())["error"]["code"] == "not_found"
    # al borrar el dashboard, el equipo vuelve al general
    await ws.send_json({"id": 7, "type": "matterai/views/delete", "view_id": v["id"]})
    await ws.receive_json()
    assert p["user_id"] not in hass.data[DOMAIN]["views"].users


NEW_CARDS = [
    {"id": "w", "type": "weather", "size": "half", "cfg": {"tap": {"type": "screen", "screen": "clima"}}},
    {"id": "c", "type": "climate", "size": "half", "cfg": {"entity": "climate.living"}},
    {"id": "cv", "type": "covers", "cfg": {"rooms": ["Living"]}},
    {"id": "l", "type": "lights", "cfg": {"entities": ["light.living"]}, "show": [{"type": "night"}, {"type": "state", "entity": "input_boolean.fiesta", "state": "on"}]},
    {"id": "e", "type": "energy", "cfg": {"entity": "sensor.consumo"}},
    {"id": "s", "type": "sensor", "cfg": {"entity": "sensor.tanque", "min": 0, "max": 1000}},
    {"id": "p", "type": "people", "cfg": {}},
    {"id": "t", "type": "text", "title": "Planta alta", "cfg": {"style": "separator"}},
    {"id": "i", "type": "image", "cfg": {"image": "/local/logo.png", "tap": {"type": "room", "room": "Living"}}},
    {"id": "b", "type": "buttons", "cfg": {"cols": 3, "items": []}},
]


async def test_new_cards_sizes_and_conditions(hass, hass_ws_client) -> None:
    await _setup(hass)
    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": "matterai/views/save", "view": {"name": "Nuevas", "layouts": {"phone": {"blocks": NEW_CARDS}}}})
    msg = await ws.receive_json()
    assert msg["success"], msg
    saved = msg["result"]["layouts"]["phone"]["blocks"]
    assert saved[0]["size"] == "half" and saved[3]["show"][1]["state"] == "on" and saved[5]["cfg"]["max"] == 1000 and saved[9]["cfg"]["cols"] == 3
    # NEGATIVO: condición desconocida, tamaño raro o imagen de afuera
    for i, bad in enumerate([{"id": "x", "type": "text", "show": [{"type": "hackear"}]}, {"id": "x", "type": "text", "size": "gigante"},
                             {"id": "x", "type": "image", "cfg": {"image": "https://malo.com/x.png"}}]):
        await ws.send_json({"id": 10 + i, "type": "matterai/views/save", "view": {"name": "Mal", "layouts": {"phone": {"blocks": [bad]}}}})
        assert not (await ws.receive_json())["success"]


async def test_try_on_device_and_history(hass, hass_ws_client, hass_client_no_auth) -> None:
    await _setup(hass)
    ws = await hass_ws_client(hass)
    client = await hass_client_no_auth()
    gian = await _phone(hass, hass_ws_client, client, "Celu Gianfranco", "dev-g")
    await ws.send_json({"id": 1, "type": "matterai/views/save", "view": {"name": "Gianfranco", "layouts": {"phone": {"blocks": PHONE}}}})
    v = (await ws.receive_json())["result"]
    await ws.send_json({"id": 2, "type": "matterai/views/assign_user", "user_id": gian["user_id"], "view_id": v["id"]})
    await ws.receive_json()
    # probar en el equipo: el celular ve el diseño sin guardar, y lo guardado no cambia
    trial = {"id": v["id"], "name": "Gianfranco", "layouts": {"phone": {"blocks": [{"id": "t", "type": "text", "title": "Prueba", "cfg": {}}]}}}
    await ws.send_json({"id": 3, "type": "matterai/views/preview", "view": trial})
    res = await ws.receive_json()
    assert res["success"] and res["result"]["minutes"] > 0
    got = await _ws(hass_ws_client, hass, gian["token"], 4, {"type": "matterai/app/view", "device_id": "dev-g", "kind": "phone"})
    assert got["result"]["preview"] is True and got["result"]["view"]["blocks"][0]["type"] == "text"
    assert hass.data[DOMAIN]["views"].views[v["id"]]["layouts"]["phone"]["blocks"][0]["type"] == "kpis"
    await ws.send_json({"id": 5, "type": "matterai/views/preview_end", "view_id": v["id"]})
    await ws.receive_json()
    got = await _ws(hass_ws_client, hass, gian["token"], 6, {"type": "matterai/app/view", "device_id": "dev-g", "kind": "phone"})
    assert got["result"]["preview"] is False and got["result"]["view"]["blocks"][0]["type"] == "kpis"
    # NEGATIVO: el celular no puede mandar pruebas
    msg = await _ws(hass_ws_client, hass, gian["token"], 7, {"type": "matterai/views/preview", "view": trial})
    assert not msg["success"]
    # historial: cada guardado deja la versión anterior para volver a ella
    await ws.send_json({"id": 8, "type": "matterai/views/save", "view": trial})
    await ws.receive_json()
    await ws.send_json({"id": 9, "type": "matterai/views/history", "view_id": v["id"]})
    vers = (await ws.receive_json())["result"]["versions"]
    assert len(vers) == 1 and vers[0]["phone"] == len(PHONE)
    await ws.send_json({"id": 10, "type": "matterai/views/history_get", "view_id": v["id"], "index": 0})
    old = (await ws.receive_json())["result"]
    assert old["layouts"]["phone"]["blocks"][0]["type"] == "kpis"
    await ws.send_json({"id": 11, "type": "matterai/views/history_get", "view_id": v["id"], "index": 5})
    assert not (await ws.receive_json())["success"]


async def test_header_and_dock_reach_the_device(hass, hass_ws_client, hass_client_no_auth) -> None:
    await _setup(hass)
    ws = await hass_ws_client(hass)
    client = await hass_client_no_auth()
    gian = await _phone(hass, hass_ws_client, client, "Celu Gianfranco", "dev-g")
    lay = {"blocks": PHONE, "header": {"weather": False}, "dock": ["top", "luces", "voice"]}
    await ws.send_json({"id": 1, "type": "matterai/views/save", "view": {"name": "G", "layouts": {"phone": lay}}})
    v = (await ws.receive_json())["result"]
    await ws.send_json({"id": 2, "type": "matterai/views/assign_user", "user_id": gian["user_id"], "view_id": v["id"]})
    await ws.receive_json()
    got = (await _ws(hass_ws_client, hass, gian["token"], 3, {"type": "matterai/app/view", "device_id": "dev-g", "kind": "phone"}))["result"]["view"]
    assert got["header"] == {"weather": False} and got["dock"] == ["top", "luces", "voice"]
    # NEGATIVO: botón de barra desconocido
    await ws.send_json({"id": 4, "type": "matterai/views/save", "view": {"name": "Mal", "layouts": {"phone": {"blocks": PHONE, "dock": ["hackear"]}}}})
    assert not (await ws.receive_json())["success"]


async def test_style_and_background_reach_the_device(hass, hass_ws_client, hass_client_no_auth) -> None:
    """Estilo prearmado y fondo: viajan al equipo, también en un diseño prearmado (sin tarjetas propias)."""
    await _setup(hass)
    ws = await hass_ws_client(hass)
    client = await hass_client_no_auth()
    gian = await _phone(hass, hass_ws_client, client, "Celu Gianfranco", "dev-g")
    lays = {"phone": {"blocks": None, "style": "cristal", "bg": {"kind": "gradient", "gradient": "aurora"}},
            "tablet": {"blocks": PHONE, "style": "apple", "bg": {"kind": "image", "image": "/api/matterai/media/0123456789abcdef.jpg", "dim": 0.4}}}
    await ws.send_json({"id": 1, "type": "matterai/views/save", "view": {"name": "G", "layouts": lays}})
    res = await ws.receive_json()
    assert res["success"], res
    v = res["result"]
    await ws.send_json({"id": 2, "type": "matterai/views/assign_user", "user_id": gian["user_id"], "view_id": v["id"]})
    await ws.receive_json()
    got = (await _ws(hass_ws_client, hass, gian["token"], 3, {"type": "matterai/app/view", "device_id": "dev-g", "kind": "phone"}))["result"]["view"]
    assert got["style"] == "cristal" and got["bg"]["gradient"] == "aurora" and not got["blocks"]
    got = (await _ws(hass_ws_client, hass, gian["token"], 4, {"type": "matterai/app/view", "device_id": "dev-g", "kind": "tablet"}))["result"]["view"]
    assert got["style"] == "apple" and got["bg"]["image"] == "/api/matterai/media/0123456789abcdef.jpg"
    # NEGATIVO: estilos, colores, degradés e imágenes que no son de la casa
    for i, bad in enumerate([{"style": "hacker"}, {"bg": {"kind": "color", "color": "red;}body{x"}}, {"bg": {"kind": "gradient", "gradient": "url(x)"}},
                             {"bg": {"kind": "image", "image": "https://malo.example/x.jpg"}}, {"bg": {"kind": "image", "image": "/api/matterai/media/0123456789abcdef.jpg", "dim": 3}}]):
        await ws.send_json({"id": 10 + i, "type": "matterai/views/save", "view": {"name": "Mal", "layouts": {"phone": {"blocks": PHONE, **bad}}}})
        assert not (await ws.receive_json())["success"], bad
