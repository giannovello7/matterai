"""Puesta en marcha: el paso a paso para dejar una casa lista, igual en todos los clientes.

Cada paso se tilda solo cuando la casa ya lo tiene (dirección, panel central, ambientes, dashboards,
celulares, avisos…). Los de la entrega al cliente los marca el instalador. Lo marcado a mano se guarda en
la casa (house.py, privado) con la fecha y quién lo marcó.
"""

from __future__ import annotations

import time
from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er

from .const import CONF_CENTRAL_KEY, CONF_LOCAL_URL, CONF_NAME, CONF_SUPPORT, CONF_URL, CONF_WIFI, DOMAIN

# grupos, en orden
GROUPS = [
    ("casa", "1 · La casa", "Datos de la instalación y cómo se llega a Home Assistant"),
    ("central", "2 · Panel central y copias", "Para vigilar la casa desde tu panel y no perder nada"),
    ("app", "3 · App del cliente", "Lo que la familia ve y usa"),
    ("auto", "4 · Automatizaciones", "Lo que hace la casa sola"),
    ("entrega", "5 · Entrega al cliente", "Lo que se hace con el cliente al terminar (lo marcás vos)"),
]

# pasos que marca el instalador: (clave, grupo, título, ayuda, opcional)
MANUAL = [
    ("m_push", "entrega", "Probar un aviso en su celular", "Equipos → «Probar…» → «Mostrar un aviso», y uno con la app cerrada (por ejemplo, abrir el portón).", False),
    ("m_explain", "entrega", "Explicarle la app", "Inicio, ambientes (tocar = luces, mantener = fijar), escenas, avisos, voz y Opciones → Conexión.", False),
    ("m_tablet", "entrega", "Dejar la tablet de pared lista", "Opciones de la app → Pantalla: modo tablet, fijar la app, protector de pantalla y «Escuchar «Mate»».", True),
    ("m_guest", "entrega", "Accesos de invitado (si los pidió)", "Equipos → Acceso de invitado, o el portón para invitados en Automatizaciones.", True),
    ("m_notes", "entrega", "Guardar los datos de la casa en tu gestor", "Dirección remota, usuario de Home Assistant y clave del panel central de esta casa.", False),
]
MANUAL_KEYS = {k for k, *_ in MANUAL}

# equipos que tienen que estar en un ambiente para aparecer en la app
ROOM_DOMAINS = ("light", "cover", "climate", "lock", "fan", "media_player")


def _opts(rt: dict[str, Any]) -> dict[str, Any]:
    e = rt["entry"]
    return {**e.data, **e.options}


def _loose_entities(hass: HomeAssistant) -> int:
    """Equipos de la casa sin ambiente (ni el suyo ni el de su dispositivo)."""
    ents, devs = er.async_get(hass), dr.async_get(hass)
    n = 0
    for st in hass.states.async_all(ROOM_DOMAINS):
        e = ents.async_get(st.entity_id)
        if e is None or e.hidden_by or e.entity_category:
            continue
        d = devs.async_get(e.device_id) if e.device_id else None
        if not (e.area_id or (d and d.area_id)):
            n += 1
    return n


def collect(hass: HomeAssistant) -> dict[str, Any]:
    rt = hass.data[DOMAIN]
    o, house = _opts(rt), rt["house"]
    hb, wd, views = rt.get("heartbeat"), rt.get("watchdog"), rt.get("views")
    steps: list[dict[str, Any]] = []

    def add(key: str, group: str, title: str, help_: str, ok: bool | None, go: str | None = None, optional: bool = False, detail: str = "") -> None:
        steps.append({"key": key, "group": group, "title": title, "help": help_, "ok": ok, "go": go, "optional": optional, "detail": detail, "manual": False})

    # 1 · la casa
    add("name", "casa", "Nombre de la casa", "Aparece en la app y en tu panel central.", bool(o.get(CONF_NAME)), "house")
    add("url", "casa", "Dirección remota", "La que usa la app fuera de la casa (por ejemplo, el túnel de Cloudflare).", bool(o.get(CONF_URL)), "house")
    add("local", "casa", "Dirección local de la casa", "Con eso la app se conecta directo cuando el celular está en el wifi de la casa (más rápido y anda sin internet). El nombre del wifi es opcional.",
        bool(o.get(CONF_LOCAL_URL)), "house", detail="" if not o.get(CONF_LOCAL_URL) or o.get(CONF_WIFI) else "Sin el nombre del wifi: la app prueba la local y, si no responde, usa la remota")
    add("support", "casa", "Tu WhatsApp de soporte", "El botón de ayuda de la app te escribe a vos.", bool(o.get(CONF_SUPPORT)), "house")
    remote = wd.remote if wd is not None else None
    add("remote", "casa", "El acceso remoto responde", "La vigilancia prueba la dirección remota cada pocos minutos.",
        None if remote is None else remote.get("kind") == "ok", "wd",
        detail="" if remote is None else {"ok": "Responde", "tunnel": "El túnel está caído", "internet": "La casa no tiene internet"}.get(remote.get("kind"), ""))
    n_areas = len(ar.async_get(hass).async_list_areas())
    loose = _loose_entities(hass)
    add("areas", "casa", "Ambientes armados", "Cada equipo en su Área de Home Assistant (o en La casa → Ambientes): así aparecen en la app.",
        n_areas > 0 and loose == 0, "casa", detail=f"{n_areas} ambientes" + (f" · {loose} equipos sin ambiente" if loose else ""))

    # 2 · panel central y copias
    configured = bool(o.get(CONF_CENTRAL_KEY))
    add("central", "central", "Conectada al panel central", "Alta de la casa en el panel (alta-cliente.ps1) y su clave en «Cambiar datos».",
        configured and bool(hb and hb.last_ok), "house", detail="" if configured else "Falta la clave de la casa")
    last_backup = hb.central.last_backup if (hb and configured) else None
    add("backup", "central", "Primera copia de seguridad", "Copias → «Hacer una copia ahora». Después se hacen solas.", bool(last_backup), "backup")

    # 3 · app del cliente
    n_views = len(views.views) if views is not None else 0
    add("dashboard", "app", "Un dashboard armado", "Dashboards → «Armar con el asistente».", n_views > 0, "views", detail=f"{n_views} dashboards" if n_views else "")
    add("default", "app", "Un dashboard por defecto (★)", "Lo ven los equipos que no tienen uno elegido.", bool(views is not None and views.default), "views", optional=True)
    n_dev = len(house.devices)
    add("phones", "app", "Celulares de la familia vinculados", "Equipos → el QR, uno por celular.", n_dev > 0, "app", detail=f"{n_dev} equipos" if n_dev else "")
    from .app_devices import app_entries  # noqa: PLC0415

    push = sum(1 for e in app_entries(hass) if (e.data.get("app_data") or {}).get("push_token"))
    add("push", "app", "Avisos con la app cerrada", "Los celulares con la app 1.13 o más nueva se registran solos (necesita el panel central).",
        push > 0, "app", detail=f"{push} equipos con avisos" if push else "")

    # 4 · automatizaciones
    manager = hass.data.get("matterai_escenas")
    n_rules = len(manager.rules) if manager is not None else 0
    add("autos", "auto", "Escenas y automatizaciones", "Automatizaciones → las básicas: buenas noches, me voy / llego, portero, avisos de aberturas.",
        n_rules > 0, "auto", detail=f"{n_rules} armadas" if n_rules else "")

    # 5 · entrega (manuales)
    done = house.data.get("setup_done") or {}
    for key, group, title, help_, optional in MANUAL:
        d = done.get(key)
        steps.append({"key": key, "group": group, "title": title, "help": help_, "ok": bool(d), "go": None, "optional": optional,
                      "detail": "", "manual": True, "at": d.get("at") if isinstance(d, dict) else None})

    need = [s for s in steps if not s["optional"]]
    return {"groups": [{"key": k, "title": t, "desc": d} for k, t, d in GROUPS], "steps": steps,
            "done": sum(1 for s in need if s["ok"]), "total": len(need)}


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/setup"})
@websocket_api.require_admin
@callback
def ws_setup(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    if not (hass.data.get(DOMAIN) or {}).get("house"):
        connection.send_error(msg["id"], "not_setup", "La integración MatterAI no está configurada")
        return
    connection.send_result(msg["id"], collect(hass))


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/setup/mark",
    vol.Required("key"): vol.In(sorted(MANUAL_KEYS)),
    vol.Required("done"): bool,
})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_setup_mark(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    house = (hass.data.get(DOMAIN) or {}).get("house")
    if house is None:
        connection.send_error(msg["id"], "not_setup", "La integración MatterAI no está configurada")
        return
    done = house.data.setdefault("setup_done", {})
    if msg["done"]:
        done[msg["key"]] = {"at": time.time(), "by": connection.user.name or ""}
    else:
        done.pop(msg["key"], None)
    await house._save()  # noqa: SLF001
    connection.send_result(msg["id"], collect(hass))


WS_COMMANDS = (ws_setup, ws_setup_mark)
