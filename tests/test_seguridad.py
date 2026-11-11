"""Seguridad: un acceso por equipo, códigos de un solo uso, desvincular, firma de accesos y copias sin secretos.

Incluye pruebas negativas: un código usado o vencido no sirve, un equipo desvinculado no entra más,
un equipo no puede hacer cosas de instalador, alguien que no es de la casa no puede disparar acciones.
"""

from __future__ import annotations

import base64
from datetime import timedelta
import json
import time

import pytest

from homeassistant.auth.const import GROUP_ID_USER
from homeassistant.auth.models import TOKEN_TYPE_LONG_LIVED_ACCESS_TOKEN
from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component

from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.matterai.app_devices import APP_ID, push_hashes
from custom_components.matterai.const import DOMAIN
from custom_components.matterai.house import CODE_HOURS

DATA = {"name": "Casa Pérez", "url": "https://perez.matterai.com.ar", "support_phone": "5491100000000", "central_key": "", "central_url": "https://panel.matterai.com.ar"}
PAIR = "/api/matterai/pair"


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    yield


def decode(code: str) -> dict:
    return json.loads(base64.urlsafe_b64decode(code + "=" * (-len(code) % 4)).decode("utf-8"))


async def _valid(hass, token):
    res = hass.auth.async_validate_access_token(token)
    return await res if hasattr(res, "__await__") else res


async def _setup(hass: HomeAssistant):
    await async_setup_component(hass, "http", {})
    entry = MockConfigEntry(domain=DOMAIN, data=DATA, title="MatterAI · Casa Pérez")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return hass.data[DOMAIN]["house"]


async def _link(ws, mid=1) -> dict:
    await ws.send_json({"id": mid, "type": "matterai/pairing"})
    msg = await ws.receive_json()
    assert msg["success"], msg
    return msg["result"]


async def _pair(client, code, name="Celular de Ana"):
    r = await client.post(PAIR, json={"code": code, "name": name})
    return r.status, await r.json()


async def _ws(hass_ws_client, hass, token, mid, payload):
    ws = await hass_ws_client(hass, token)
    await ws.send_json({"id": mid, **payload})
    return await ws.receive_json()


async def _shared(hass, house):
    """El acceso compartido de las versiones anteriores (un usuario y un token para todos los celulares)."""
    user = await hass.auth.async_create_user("App MatterAI", group_ids=[GROUP_ID_USER])
    rt = await hass.auth.async_create_refresh_token(user, client_name="App MatterAI viejo", token_type=TOKEN_TYPE_LONG_LIVED_ACCESS_TOKEN,
                                                    access_token_expiration=timedelta(days=3650))
    token = hass.auth.async_create_access_token(rt)
    house.data.update(user_id=user.id, refresh_id=rt.id, token=token)
    return user, token


# ---------------------------------------------------------------- vinculación
async def test_link_has_one_time_code_not_token(hass, hass_ws_client) -> None:
    await _setup(hass)
    ws = await hass_ws_client(hass)
    pair = await _link(ws)
    data = decode(pair["code"])
    assert pair["link"].startswith("https://app.matterai.com.ar/#v=")
    assert "t" not in data and data["c"], "el link no lleva el acceso, sólo un código"
    assert data["u"] == "https://perez.matterai.com.ar" and pair["hours"] == CODE_HOURS
    other = decode((await _link(ws, 2))["code"])
    assert other["c"] != data["c"], "cada vez un código distinto"


async def test_code_gives_own_non_admin_access_and_only_once(hass, hass_ws_client, hass_client_no_auth) -> None:
    house = await _setup(hass)
    ws = await hass_ws_client(hass)
    code = decode((await _link(ws))["code"])["c"]
    client = await hass_client_no_auth()
    status, body = await _pair(client, code)
    assert status == 200 and body["ok"]
    rt = await _valid(hass, body["token"])
    assert rt is not None and rt.user.id == body["user_id"]
    assert not rt.user.is_admin and rt.user.name == "App · Celular de Ana"
    assert house.is_device_user(rt.user.id)
    # NEGATIVO: el mismo código no sirve dos veces
    status, body2 = await _pair(client, code, "Otro")
    assert status == 403 and not body2["ok"] and "token" not in body2
    # NEGATIVO: un código inventado tampoco
    status, _ = await _pair(client, "inventado-123")
    assert status == 403


async def test_two_phones_get_different_access(hass, hass_ws_client, hass_client_no_auth) -> None:
    await _setup(hass)
    ws = await hass_ws_client(hass)
    client = await hass_client_no_auth()
    _, a = await _pair(client, decode((await _link(ws, 1))["code"])["c"], "Ana")
    _, b = await _pair(client, decode((await _link(ws, 2))["code"])["c"], "Juan")
    assert a["token"] != b["token"] and a["user_id"] != b["user_id"]


async def test_same_device_paired_again_replaces_old_link(hass, hass_ws_client, hass_client_no_auth) -> None:
    """La misma tablet vinculada dos veces: queda un solo equipo, con el dashboard que tenía el viejo."""
    house = await _setup(hass)
    ws = await hass_ws_client(hass)
    client = await hass_client_no_auth()
    ik = "f" * 32
    r1 = await client.post(PAIR, json={"code": decode((await _link(ws, 1))["code"])["c"], "name": "Tablet", "install": ik})
    a = await r1.json()
    views = hass.data[DOMAIN]["views"]
    vid = views.put({"name": "Gianfranco", "kind": "tablet"})["id"]
    views.set_user(a["user_id"], vid)
    _, other = await _pair(client, decode((await _link(ws, 2))["code"])["c"], "Celular")  # otro equipo: no se toca
    r2 = await client.post(PAIR, json={"code": decode((await _link(ws, 3))["code"])["c"], "name": "Tablet", "install": ik})
    b = await r2.json()
    assert r2.status == 200 and b["user_id"] != a["user_id"]
    assert not house.is_device_user(a["user_id"]), "el vínculo viejo se borró"
    assert await _valid(hass, a["token"]) is None, "y su acceso ya no sirve"
    assert house.is_device_user(b["user_id"]) and house.is_device_user(other["user_id"])
    assert views.users.get(b["user_id"]) == vid, "el dashboard pasó al vínculo nuevo"
    assert [d["name"] for d in house.listing()].count("Tablet") == 1
    assert all(ik not in json.dumps(d) for d in house.devices.values()), "sólo se guarda la huella, nunca el número de la app"


async def test_expired_code_fails(hass, hass_ws_client, hass_client_no_auth) -> None:
    house = await _setup(hass)
    ws = await hass_ws_client(hass)
    code = decode((await _link(ws))["code"])["c"]
    for c in house.data["codes"].values():
        c["exp"] = time.time() - 1
    client = await hass_client_no_auth()
    status, body = await _pair(client, code)
    assert status == 403 and "token" not in body  # NEGATIVO: vencido


async def test_pair_rate_limit(hass, hass_client_no_auth) -> None:
    await _setup(hass)
    client = await hass_client_no_auth()
    for _ in range(10):
        assert (await _pair(client, "malo"))[0] == 403
    assert (await _pair(client, "malo"))[0] == 429  # NEGATIVO: freno a quien prueba códigos


async def test_bad_request_rejected(hass, hass_client_no_auth) -> None:
    await _setup(hass)
    client = await hass_client_no_auth()
    r = await client.post(PAIR, data="no es json")
    assert r.status == 400
    r = await client.post(PAIR, json={"code": 123})
    assert r.status == 400


# ---------------------------------------------------------------- invitados
async def test_guest_access_expires_alone(hass, hass_ws_client, hass_client_no_auth) -> None:
    """Un acceso de invitado entra con su perfil y se corta solo al vencer; los demás siguen."""
    from custom_components.matterai.pairing import async_expire_guests

    house = await _setup(hass)
    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": "matterai/pairing", "guest_hours": 24, "profile": "kids"})
    g = (await ws.receive_json())["result"]
    assert g["guest"]["profile"] == "kids" and g["guest"]["until"] > time.time() + 23 * 3600
    client = await hass_client_no_auth()
    status, guest = await _pair(client, decode(g["code"])["c"], "Abuela")
    assert status == 200
    _, ana = await _pair(client, decode((await _link(ws, 2))["code"])["c"], "Ana")
    d = house.devices[guest["user_id"]]
    assert d["via"] == "guest" and d["profile"] == "kids" and d.get("until")
    # entra con el perfil del link mientras el instalador no le elija otro
    msg = await _ws(hass_ws_client, hass, guest["token"], 1, {"type": "matterai/app/me", "device_id": "dev-abuela"})
    assert msg["result"]["profile"] == "kids"
    assert await async_expire_guests(hass) == 0, "todavía no venció"
    d["until"] = time.time() - 1
    assert await async_expire_guests(hass) == 1
    await hass.async_block_till_done()
    assert await _valid(hass, guest["token"]) is None  # NEGATIVO: vencido, no entra más
    assert await _valid(hass, ana["token"]) is not None, "los demás siguen andando"


async def test_guest_link_rejects_bad_values(hass, hass_ws_client) -> None:
    await _setup(hass)
    ws = await hass_ws_client(hass)
    for i, bad in enumerate([{"guest_hours": 0}, {"guest_hours": 24 * 365}, {"guest_hours": 5, "profile": "admin"}]):
        await ws.send_json({"id": i + 1, "type": "matterai/pairing", **bad})
        assert not (await ws.receive_json())["success"], bad  # NEGATIVO


async def test_remote_test_and_message_only_installer(hass, hass_ws_client, hass_client_no_auth) -> None:
    """Probar un equipo y mandar un mensaje: sólo el instalador; le llega al equipo que está escuchando."""
    await _setup(hass)
    ws = await hass_ws_client(hass)
    client = await hass_client_no_auth()
    _, ana = await _pair(client, decode((await _link(ws, 1))["code"])["c"], "Ana")
    app = await hass_ws_client(hass, ana["token"])
    await app.send_json({"id": 1, "type": "matterai/app/subscribe", "device_id": "dev-ana", "name": "Ana"})
    assert (await app.receive_json())["success"]
    assert hass.data[DOMAIN]["app_devices"].online.get("dev-ana") == 1
    await ws.send_json({"id": 2, "type": "matterai/app/test", "device_id": "dev-ana", "command": "hello"})
    res = await ws.receive_json()
    assert res["success"] and res["result"]["online"]
    ev = await app.receive_json()
    assert ev["event"]["command"] == "hello" and ev["event"]["target"] == ["dev-ana"]
    await ws.send_json({"id": 3, "type": "matterai/app/message", "text": "  Mañana  paso a revisar "})
    res = await ws.receive_json()
    assert res["success"] and res["result"]["online"] == 1
    ev = await app.receive_json()
    assert ev["event"]["message"] == "Mañana paso a revisar"
    # NEGATIVO: un equipo no puede probar ni mandar mensajes a los demás
    await app.send_json({"id": 4, "type": "matterai/app/message", "text": "hola"})
    assert not (await app.receive_json())["success"]
    await app.send_json({"id": 5, "type": "matterai/app/test", "device_id": "dev-ana", "command": "reload"})
    assert not (await app.receive_json())["success"]
    # NEGATIVO: sólo las pruebas conocidas
    await ws.send_json({"id": 6, "type": "matterai/app/test", "device_id": "dev-ana", "command": "screen_off"})
    assert not (await ws.receive_json())["success"]
    await app.close()
    await hass.async_block_till_done()
    assert "dev-ana" not in hass.data[DOMAIN]["app_devices"].online, "al cerrar la app deja de figurar conectada"


# ---------------------------------------------------------------- desvincular
async def test_revoke_cuts_only_that_phone(hass, hass_ws_client, hass_client_no_auth) -> None:
    await _setup(hass)
    ws = await hass_ws_client(hass)
    client = await hass_client_no_auth()
    _, ana = await _pair(client, decode((await _link(ws, 1))["code"])["c"], "Ana")
    _, juan = await _pair(client, decode((await _link(ws, 2))["code"])["c"], "Juan")
    phone = MockConfigEntry(domain="mobile_app", data={"app_id": APP_ID, "device_id": "dev-ana", "device_name": "Ana", "user_id": ana["user_id"], "webhook_id": "w-ana"})
    phone.add_to_hass(hass)
    await ws.send_json({"id": 3, "type": "matterai/app/access"})
    acc = (await ws.receive_json())["result"]
    assert {d["name"] for d in acc["devices"]} == {"Ana", "Juan"}
    assert next(d for d in acc["devices"] if d["name"] == "Ana")["apps"] == ["Ana"]

    await ws.send_json({"id": 4, "type": "matterai/app/revoke", "user_id": ana["user_id"]})
    assert (await ws.receive_json())["success"]
    await hass.async_block_till_done()
    assert await _valid(hass, ana["token"]) is None  # NEGATIVO: el celular perdido ya no entra
    assert await _hass_user(hass, ana["user_id"]) is None
    assert hass.config_entries.async_get_entry(phone.entry_id) is None, "también se borra su registro (avisos, ubicación)"
    assert await _valid(hass, juan["token"]) is not None, "los demás siguen andando"


async def _hass_user(hass, uid):
    return await hass.auth.async_get_user(uid)


async def test_forget_me(hass, hass_ws_client, hass_client_no_auth) -> None:
    await _setup(hass)
    ws = await hass_ws_client(hass)
    client = await hass_client_no_auth()
    _, ana = await _pair(client, decode((await _link(ws))["code"])["c"], "Ana")
    msg = await _ws(hass_ws_client, hass, ana["token"], 1, {"type": "matterai/app/forget_me"})
    assert msg["success"] and msg["result"]["ok"]
    await hass.async_block_till_done()
    assert await _valid(hass, ana["token"]) is None


async def test_phone_cannot_do_installer_things(hass, hass_ws_client, hass_client_no_auth) -> None:
    await _setup(hass)
    ws = await hass_ws_client(hass)
    client = await hass_client_no_auth()
    _, ana = await _pair(client, decode((await _link(ws, 1))["code"])["c"], "Ana")
    _, juan = await _pair(client, decode((await _link(ws, 2))["code"])["c"], "Juan")
    # NEGATIVO: un celular no puede desvincular a otro, ver los accesos, sacar QR de instalador ni apagar el compartido
    for i, payload in enumerate([
        {"type": "matterai/app/revoke", "user_id": juan["user_id"]},
        {"type": "matterai/app/access"},
        {"type": "matterai/pairing"},
        {"type": "matterai/app/shared_off"},
        {"type": "matterai/app/device_set", "device_id": "x", "profile": "full"},
        {"type": "matterai/config/save", "config": {}},
    ]):
        msg = await _ws(hass_ws_client, hass, ana["token"], 10 + i, payload)
        assert not msg["success"] and msg["error"]["code"] == "unauthorized", payload
    assert await _valid(hass, juan["token"]) is not None


# ---------------------------------------------------------------- agregar otro celular
async def test_invite_from_app(hass, hass_ws_client, hass_client_no_auth) -> None:
    hass_house = await _setup(hass)
    ws = await hass_ws_client(hass)
    client = await hass_client_no_auth()
    _, ana = await _pair(client, decode((await _link(ws))["code"])["c"], "Ana")
    msg = await _ws(hass_ws_client, hass, ana["token"], 1, {"type": "matterai/app/invite"})
    assert msg["success"], msg
    status, sofi = await _pair(client, decode(msg["result"]["code"])["c"], "Sofi")
    assert status == 200 and hass_house.devices[sofi["user_id"]]["via"] == "invite"
    assert hass_house.devices[sofi["user_id"]]["by"] == ana["user_id"], "queda quién lo agregó"


async def test_invite_denied_for_kids_profile_and_strangers(hass, hass_ws_client, hass_client_no_auth, hass_read_only_access_token) -> None:
    await _setup(hass)
    ws = await hass_ws_client(hass)
    client = await hass_client_no_auth()
    _, nene = await _pair(client, decode((await _link(ws))["code"])["c"], "Tablet chicos")
    await ws.send_json({"id": 2, "type": "matterai/app/device_set", "device_id": "dev-kids", "profile": "kids"})
    assert (await ws.receive_json())["success"]
    msg = await _ws(hass_ws_client, hass, nene["token"], 1, {"type": "matterai/app/invite", "device_id": "dev-kids"})
    assert not msg["success"]  # NEGATIVO: el perfil de los chicos no agrega celulares
    msg = await _ws(hass_ws_client, hass, hass_read_only_access_token, 1, {"type": "matterai/app/invite"})
    assert not msg["success"]  # NEGATIVO: un usuario de HA que no es de la app tampoco


# ---------------------------------------------------------------- acceso compartido (versión anterior)
async def test_shared_access_upgrades_itself(hass, hass_ws_client) -> None:
    house = await _setup(hass)
    user, shared_token = await _shared(hass, house)
    phone = MockConfigEntry(domain="mobile_app", data={"app_id": APP_ID, "device_id": "dev-viejo", "device_name": "Celu viejo", "user_id": user.id, "webhook_id": "w1"})
    phone.add_to_hass(hass)
    me = await _ws(hass_ws_client, hass, shared_token, 1, {"type": "matterai/app/me", "device_id": "dev-viejo"})
    assert me["result"]["shared"] is True and me["result"]["run_key"] == house.run_key
    up = await _ws(hass_ws_client, hass, shared_token, 2, {"type": "matterai/app/upgrade", "name": "Celu viejo", "device_id": "dev-viejo"})
    assert up["success"]
    new = await _valid(hass, up["result"]["token"])
    assert new is not None and house.is_device_user(new.user.id)
    assert hass.config_entries.async_get_entry(phone.entry_id).data["user_id"] == new.user.id, "su registro pasa a su usuario"
    me2 = await _ws(hass_ws_client, hass, up["result"]["token"], 7, {"type": "matterai/app/me", "device_id": "dev-viejo"})
    assert me2["result"]["webhook_id"] == "w1", "con el acceso nuevo, la app recupera su registro (no queda con un webhook muerto)"
    other = await _ws(hass_ws_client, hass, shared_token, 8, {"type": "matterai/app/me", "device_id": "dev-viejo"})
    assert "webhook_id" not in other["result"], "NEGATIVO: otro usuario no ve el registro de este equipo"
    again = await _ws(hass_ws_client, hass, up["result"]["token"], 3, {"type": "matterai/app/upgrade", "name": "x"})
    assert not again["success"] and again["error"]["code"] == "not_shared"  # NEGATIVO: no se multiplica

    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 4, "type": "matterai/app/access"})
    assert (await ws.receive_json())["result"]["shared"]["devices"] == []
    await ws.send_json({"id": 5, "type": "matterai/app/shared_off"})
    assert (await ws.receive_json())["success"]
    await hass.async_block_till_done()
    assert await _valid(hass, shared_token) is None  # NEGATIVO: el acceso compartido ya no entra
    assert await _valid(hass, up["result"]["token"]) is not None, "el equipo que se pasó sigue andando"
    up2 = await _ws(hass_ws_client, hass, up["result"]["token"], 6, {"type": "matterai/app/upgrade"})
    assert not up2["success"]


async def test_other_user_cannot_upgrade(hass, hass_ws_client, hass_read_only_access_token) -> None:
    house = await _setup(hass)
    await _shared(hass, house)
    msg = await _ws(hass_ws_client, hass, hass_read_only_access_token, 1, {"type": "matterai/app/upgrade"})
    assert not msg["success"]  # NEGATIVO: sólo el acceso compartido de la app puede pasarse
    me = await _ws(hass_ws_client, hass, hass_read_only_access_token, 2, {"type": "matterai/app/me", "device_id": "x"})
    assert "run_key" not in me["result"], "la firma de los accesos sólo la reciben los equipos de la casa"


# ---------------------------------------------------------------- portero y avisos
async def test_notify_action_only_house_devices(hass, hass_ws_client, hass_client_no_auth, hass_read_only_access_token) -> None:
    await _setup(hass)
    got = []
    hass.bus.async_listen("mobile_app_notification_action", lambda e: got.append(e.data["action"]))
    msg = await _ws(hass_ws_client, hass, hass_read_only_access_token, 1, {"type": "matterai/app/notify_action", "action": "MAE|r1|open"})
    await hass.async_block_till_done()
    assert not msg["success"] and got == []  # NEGATIVO: alguien que no es de la casa no abre el portón
    ws = await hass_ws_client(hass)
    client = await hass_client_no_auth()
    _, ana = await _pair(client, decode((await _link(ws))["code"])["c"], "Ana")
    msg = await _ws(hass_ws_client, hass, ana["token"], 2, {"type": "matterai/app/notify_action", "action": "MAE|r1|open"})
    await hass.async_block_till_done()
    assert msg["success"] and got == ["MAE|r1|open"]


async def test_push_hashes_never_send_secrets(hass) -> None:
    await _setup(hass)
    MockConfigEntry(domain="mobile_app", data={"app_id": APP_ID, "device_id": "d1", "webhook_id": "hook-secreto", "app_data": {"push_token": "TOKEN-FCM-SECRETO"}}).add_to_hass(hass)
    MockConfigEntry(domain="mobile_app", data={"app_id": "io.homeassistant.companion.android", "webhook_id": "w2", "app_data": {"push_token": "OTRA-APP"}}).add_to_hass(hass)
    hashes = push_hashes(hass)
    assert len(hashes) == 1 and len(hashes[0]) == 64
    blob = json.dumps(hashes)
    assert "SECRETO" not in blob and "hook" not in blob  # NEGATIVO: al panel no viaja ni el token ni el webhook


# ---------------------------------------------------------------- copias sin secretos
async def test_central_backup_has_no_guest_links(hass) -> None:
    await _setup(hass)
    from custom_components.matterai.backup import collect  # noqa: PLC0415

    manager = hass.data.get("matterai_escenas") or next(v for k, v in hass.data.items() if hasattr(v, "export_rules"))
    manager.rules["inv1"] = {"id": "inv1", "kind": "guest", "name": "Invitados", "enabled": False,
                             "invites": [{"token": "LINK-SECRETO-PORTON", "name": "Empleada"}], "history": [{"ip": "1.2.3.4"}]}
    central, _ = collect(hass, private=False)
    blob = json.dumps(central)
    assert "LINK-SECRETO-PORTON" not in blob and "1.2.3.4" not in blob  # NEGATIVO: el panel nunca recibe links de invitado
    local, _ = collect(hass)
    assert "LINK-SECRETO-PORTON" in json.dumps(local), "la copia local (para deshacer) va completa"

    # restaurar una copia del panel no borra los invitados de la casa
    await manager.async_restore(central["automations"]["rules"], None)
    assert manager.rules["inv1"]["invites"][0]["token"] == "LINK-SECRETO-PORTON"


# ---------------------------------------------------------------- avisos de seguridad de la casa
async def test_security_alerts(hass, hass_admin_user) -> None:
    house = await _setup(hass)
    from custom_components.matterai.health import async_security_alerts  # noqa: PLC0415

    keys = {a["key"]: a for a in await async_security_alerts(hass)}
    assert "security:ip_ban" in keys, "HA en internet sin bloqueo de intentos: avisa"
    assert "security:mfa" in keys and hass_admin_user.name in keys["security:mfa"]["text"], "administrador sin 2 pasos: avisa"
    assert "security:shared" not in keys, "sin acceso compartido, nada que apagar"
    await _shared(hass, house)
    keys = {a["key"] for a in await async_security_alerts(hass)}
    assert "security:shared" in keys, "acceso compartido prendido que ya nadie usa: sugiere apagarlo"


async def test_app_learns_local_address(hass, hass_ws_client, hass_client_no_auth, hass_read_only_access_token) -> None:
    """Un equipo vinculado antes de cargar la dirección local la aprende al conectarse (y si cambia, también)."""
    await _setup(hass)
    ws = await hass_ws_client(hass)
    client = await hass_client_no_auth()
    _, p = await _pair(client, decode((await _link(ws))["code"])["c"], "Celu")
    entry = hass.data[DOMAIN]["entry"]
    hass.config_entries.async_update_entry(entry, options={**entry.options, "local_url": "http://192.168.1.10:8123", "wifi": "CasaWifi, CasaWifi_5G"})
    msg = await _ws(hass_ws_client, hass, p["token"], 2, {"type": "matterai/app/net"})
    assert msg["success"], msg
    r = msg["result"]
    assert r["local"] == "http://192.168.1.10:8123" and r["wifi"] == ["CasaWifi", "CasaWifi_5G"] and r["remote"].startswith("https://")
    # NEGATIVO: un usuario que no es un equipo de la casa no la puede pedir
    msg = await _ws(hass_ws_client, hass, hass_read_only_access_token, 3, {"type": "matterai/app/net"})
    assert not msg["success"]


# ---------------------------------------------------------------- puesta en marcha
async def test_setup_checklist(hass, hass_ws_client, hass_client_no_auth) -> None:
    """El paso a paso se tilda solo con lo que tiene la casa; lo de la entrega lo marca el instalador."""
    await _setup(hass)
    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": "matterai/setup"})
    r = (await ws.receive_json())["result"]
    st = {s["key"]: s for s in r["steps"]}
    assert st["name"]["ok"] and st["url"]["ok"] and st["support"]["ok"], "los datos del alta ya están"
    assert not st["local"]["ok"] and not st["phones"]["ok"] and not st["dashboard"]["ok"]
    assert not st["central"]["ok"], "sin la clave de la casa no está conectada al panel central"
    assert r["done"] < r["total"] and {g["key"] for g in r["groups"]} == {"casa", "central", "app", "auto", "entrega"}
    # vincular un celular lo tilda solo
    client = await hass_client_no_auth()
    _, ana = await _pair(client, decode((await _link(ws, 2))["code"])["c"], "Ana")
    await ws.send_json({"id": 3, "type": "matterai/setup"})
    assert {s["key"]: s for s in (await ws.receive_json())["result"]["steps"]}["phones"]["ok"]
    # lo de la entrega se marca y se desmarca
    await ws.send_json({"id": 4, "type": "matterai/setup/mark", "key": "m_explain", "done": True})
    res = await ws.receive_json()
    m = {s["key"]: s for s in res["result"]["steps"]}["m_explain"]
    assert m["ok"] and m["at"] and m["manual"]
    await ws.send_json({"id": 5, "type": "matterai/setup/mark", "key": "m_explain", "done": False})
    assert not {s["key"]: s for s in (await ws.receive_json())["result"]["steps"]}["m_explain"]["ok"]
    # NEGATIVO: no se marcan pasos automáticos ni inventados
    await ws.send_json({"id": 6, "type": "matterai/setup/mark", "key": "central", "done": True})
    assert not (await ws.receive_json())["success"]
    # NEGATIVO: un celular de la casa no ve ni marca la puesta en marcha
    msg = await _ws(hass_ws_client, hass, ana["token"], 1, {"type": "matterai/setup"})
    assert not msg["success"]
    msg = await _ws(hass_ws_client, hass, ana["token"], 1, {"type": "matterai/setup/mark", "key": "m_push", "done": True})
    assert not msg["success"]


async def test_web_app_names_itself_and_gets_its_dashboard(hass, hass_ws_client, hass_client_no_auth) -> None:
    """La app web (sin registro de mobile_app): dice qué equipo es, recibe su dashboard por su usuario y el aviso de cambios."""
    from custom_components.matterai.app_devices import _targets_me
    from custom_components.matterai.views import _targets

    house = await _setup(hass)
    ws = await hass_ws_client(hass)
    client = await hass_client_no_auth()
    _, web = await _pair(client, decode((await _link(ws, 1))["code"])["c"], "Celular")
    _, ana = await _pair(client, decode((await _link(ws, 2))["code"])["c"], "Celular de Ana")
    msg = await _ws(hass_ws_client, hass, web["token"], 1, {"type": "matterai/app/name", "name": "iPhone (web)"})
    assert msg["success"] and msg["result"]["name"] == "iPhone (web)"
    assert house.devices[web["user_id"]]["name"] == "iPhone (web)"
    assert (await hass.auth.async_get_user(web["user_id"])).name == "App · iPhone (web)"
    # un nombre que ya no es el genérico no se pisa
    msg = await _ws(hass_ws_client, hass, web["token"], 1, {"type": "matterai/app/name", "name": "Otro"})
    assert msg["success"] and msg["result"]["name"] is None and house.devices[web["user_id"]]["name"] == "iPhone (web)"
    msg = await _ws(hass_ws_client, hass, ana["token"], 1, {"type": "matterai/app/name", "name": "iPhone (web)"})
    assert msg["result"]["name"] is None and house.devices[ana["user_id"]]["name"] == "Celular de Ana"
    # su dashboard, aunque no mande device_id
    views = hass.data[DOMAIN]["views"]
    vid = views.put({"name": "Mío", "kind": "phone"})["id"]
    views.set_user(web["user_id"], vid)
    msg = await _ws(hass_ws_client, hass, web["token"], 1, {"type": "matterai/app/view", "device_id": "", "kind": "phone"})
    assert msg["success"] and msg["result"]["view"]["id"] == vid and msg["result"]["personal"]
    # al cambiar el dashboard le llega el aviso por su usuario
    assert web["user_id"] in _targets(hass, views, vid)
    assert _targets_me([web["user_id"]], "", "iPhone (web)", web["user_id"])
    assert not _targets_me([web["user_id"]], "", "", ana["user_id"]), "NEGATIVO: a otro equipo no"
    assert not _targets_me(["abc"], "", "", ""), "NEGATIVO: sin datos no coincide con nada"
