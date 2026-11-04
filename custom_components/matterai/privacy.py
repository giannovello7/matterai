"""Privacidad (Ley 25.326): consentimientos versionados, exportar mis datos y pedidos ARCO.

- Consentimientos: la app manda qué versión de los Términos y la Política de Privacidad aceptó cada equipo,
  y los permisos opcionales (ubicación, cámaras, novedades, datos de uso). Se guarda la historia completa con
  fecha, hora, IP, equipo y app: POST /api/matterai/consent (con el acceso del equipo). Revocables desde la app.
- Exportar: matterai/app/export devuelve todo lo que la casa guarda de ese equipo (sin claves ni tokens).
- Pedidos ARCO (acceso, rectificación, supresión/baja, oposición): matterai/app/arco. Quedan registrados con su
  estado; le llegan al instalador como aviso (panel MatterAI, panel central y Telegram) hasta que los resuelve.
"""

from __future__ import annotations

import json
import logging
import time
import uuid
from typing import Any

from aiohttp import web
import voluptuous as vol

from homeassistant.components import persistent_notification, websocket_api
from homeassistant.components.http import HomeAssistantView
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.storage import Store

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

STORAGE_KEY = f"{DOMAIN}.privacy"
CONSENT_PATH = "/api/matterai/consent"
DOCS = {
    "terms": "Términos y condiciones",
    "privacy": "Política de privacidad",
    "location": "Compartir la ubicación con la casa",
    "cameras": "Responsabilidades al usar cámaras",
    "marketing": "Novedades y promociones de MatterAI",
    "improve": "Datos de uso anónimos para mejorar el producto",
}
ARCO_KINDS = {
    "access": "Acceso a mis datos",
    "rectify": "Corrección de mis datos",
    "delete": "Baja y borrado de mis datos",
    "oppose": "Oposición a un uso de mis datos",
}
MAX_HISTORY = 200  # por equipo


def _rt(hass: HomeAssistant) -> dict[str, Any]:
    return hass.data.get(DOMAIN) or {}


class Privacy:
    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store: Store = Store(hass, 1, STORAGE_KEY, private=True)
        self.consents: dict[str, list[dict[str, Any]]] = {}
        self.arco: list[dict[str, Any]] = []

    async def async_load(self) -> None:
        data = await self._store.async_load() or {}
        self.consents = data.get("consents") or {}
        self.arco = data.get("arco") or []

    def _save(self) -> None:
        self._store.async_delay_save(lambda: {"consents": self.consents, "arco": self.arco}, 2)

    # ------------------------------------------------------------ consentimientos
    def record(self, user_id: str, items: list[dict[str, Any]], ip: str, device: str, device_id: str, ua: str) -> list[dict[str, Any]]:
        now = time.time()
        rows = []
        for it in items:
            doc = it.get("doc")
            if doc not in DOCS:
                continue
            row = {"doc": doc, "version": str(it.get("version") or "")[:40], "accepted": bool(it.get("accepted")),
                   "at": now, "ip": ip, "device": device[:60], "device_id": device_id[:64], "app": ua[:120]}
            rows.append(row)
        hist = self.consents.setdefault(user_id, [])
        hist.extend(rows)
        del hist[:-MAX_HISTORY]
        self._save()
        return rows

    def current(self, user_id: str) -> dict[str, dict[str, Any]]:
        out: dict[str, dict[str, Any]] = {}
        for row in self.consents.get(user_id, []):
            out[row["doc"]] = row
        return out

    # ------------------------------------------------------------ pedidos ARCO
    def new_request(self, user_id: str, kind: str, detail: str, device: str) -> dict[str, Any]:
        req = {"id": uuid.uuid4().hex[:10], "at": time.time(), "kind": kind, "detail": detail[:1000], "device": device[:60],
               "user_id": user_id, "status": "open", "resolved_at": None, "note": ""}
        self.arco.append(req)
        self._save()
        persistent_notification.async_create(
            self.hass,
            f"«{device}» pidió: **{ARCO_KINDS[kind]}**.{f' Detalle: {detail}' if detail else ''}\n\n"
            "La ley da 10 días corridos para responder un pedido de acceso y 5 días hábiles para rectificación o supresión. "
            "Resolvelo en el panel MatterAI → Seguridad → Pedidos de datos.",
            title="MatterAI: pedido sobre datos personales",
            notification_id=f"matterai_arco_{req['id']}",
        )
        return req

    def resolve(self, req_id: str, note: str) -> dict[str, Any] | None:
        for r in self.arco:
            if r["id"] == req_id and r["status"] == "open":
                r.update(status="done", resolved_at=time.time(), note=note[:500])
                self._save()
                persistent_notification.async_dismiss(self.hass, f"matterai_arco_{req_id}")
                return r
        return None

    def open_requests(self) -> list[dict[str, Any]]:
        return [r for r in self.arco if r["status"] == "open"]


def _device_label(hass: HomeAssistant, user_id: str) -> str:
    house = _rt(hass).get("house")
    if house is not None and house.is_device_user(user_id):
        return house.devices[user_id].get("name") or "Equipo"
    return "Equipo"


def _is_app(hass: HomeAssistant, connection) -> bool:
    house = _rt(hass).get("house")
    return house is not None and house.is_app_user(connection.user.id)


class ConsentView(HomeAssistantView):
    """La app registra lo que aceptó este equipo (con su acceso: así queda a qué equipo corresponde y su IP)."""

    url = CONSENT_PATH
    name = f"api:{DOMAIN}:consent"
    requires_auth = True
    cors_allowed = True

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass

    async def post(self, request: web.Request) -> web.Response:
        user = request["hass_user"]
        pv = _rt(self.hass).get("privacy")
        house = _rt(self.hass).get("house")
        if pv is None or house is None or not (house.is_app_user(user.id) or user.is_admin):
            return self.json({"ok": False, "msg": "Este usuario no es un equipo de la casa"}, status_code=403)
        try:
            body = await request.json()
        except (ValueError, json.JSONDecodeError):
            return self.json({"ok": False, "msg": "Pedido inválido"}, status_code=400)
        items = body.get("items") if isinstance(body, dict) else None
        if not isinstance(items, list) or not items or len(items) > 20:
            return self.json({"ok": False, "msg": "Pedido inválido"}, status_code=400)
        device = str(body.get("device") or _device_label(self.hass, user.id))
        rows = pv.record(user.id, [i for i in items if isinstance(i, dict)], request.remote or "?", device, str(body.get("device_id") or ""),
                         request.headers.get("User-Agent", ""))
        from .audit import log as audit_log  # noqa: PLC0415

        for r in rows:
            audit_log(self.hass, "legal", f"{DOCS[r['doc']]}: {'aceptó' if r['accepted'] else 'no aceptó / revocó'}", r["version"], f"app · {device}", f"desde {r['ip']}")
        return self.json({"ok": True, "saved": len(rows)})


@callback
def async_register_view(hass: HomeAssistant) -> None:
    flag = f"{DOMAIN}_consent_view"
    if not hass.data.get(flag):
        hass.http.register_view(ConsentView(hass))
        hass.data[flag] = True


# ---------------------------------------------------------------- comandos de la app
@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/app/consents"})
@callback
def ws_app_consents(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    pv = _rt(hass).get("privacy")
    if pv is None or not _is_app(hass, connection):
        connection.send_error(msg["id"], "unauthorized", "Este usuario no es un equipo de la casa")
        return
    connection.send_result(msg["id"], {"current": pv.current(connection.user.id), "docs": DOCS})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/app/export", vol.Optional("device_id", default=""): str})
@websocket_api.async_response
async def ws_app_export(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Todo lo que la casa guarda de este equipo (derecho de acceso). Sin claves, tokens ni webhooks."""
    rt = _rt(hass)
    pv, house, ad, audit = rt.get("privacy"), rt.get("house"), rt.get("app_devices"), rt.get("audit")
    uid = connection.user.id
    if pv is None or house is None or not house.is_app_user(uid):
        connection.send_error(msg["id"], "unauthorized", "Este usuario no es un equipo de la casa")
        return
    from homeassistant.helpers import device_registry as dr, entity_registry as er  # noqa: PLC0415

    from .app_devices import app_entries  # noqa: PLC0415

    name = _device_label(hass, uid)
    # sólo los registros de ESTE usuario (el device_id que manda la app no alcanza: lo podría inventar otro equipo).
    # Con el acceso compartido viejo, varios equipos tienen el mismo usuario: ahí además tiene que coincidir el device_id.
    shared = house.is_shared_user(uid)
    mine = [e for e in app_entries(hass) if e.data.get("user_id") == uid and (not shared or e.data.get("device_id") == msg["device_id"])]
    ids = {e.data.get("device_id") for e in mine}
    ent_reg, dev_reg = er.async_get(hass), dr.async_get(hass)
    states = []
    for e in mine:
        dev = dev_reg.async_get_device(identifiers={("mobile_app", e.data.get("device_id"))})
        if dev is None:
            continue
        for ent in er.async_entries_for_device(ent_reg, dev.id):
            st = hass.states.get(ent.entity_id)
            if st is not None:
                states.append({"entity_id": st.entity_id, "state": st.state, "attributes": {k: v for k, v in st.attributes.items() if k not in ("entity_picture",)},
                               "last_changed": st.last_changed.isoformat()})
    data = {
        "generated": time.time(),
        "casa": (rt.get("entry").options.get("name") if rt.get("entry") else "") or "",
        "equipo": {k: v for k, v in (house.devices.get(uid) or {}).items() if k != "refresh_id"},
        "registros_en_la_casa": [{"nombre": e.data.get("device_name"), "fabricante": e.data.get("manufacturer"), "modelo": e.data.get("model"),
                                  "sistema": e.data.get("os_version"), "app": e.data.get("app_version")} for e in mine],
        "perfiles": {i: ad.profile(i) for i in ids if i} if ad else {},
        "datos_actuales_del_equipo": states,
        "consentimientos": pv.consents.get(uid, []),
        "ordenes_dadas": [a for a in (ad.actions if ad else []) if a.get("device_id") and a.get("device_id") in ids],
        "registro_de_auditoria": [e for e in (audit.entries if audit else []) if e.get("who") == f"app · {name}"],
        "pedidos_arco": [r for r in pv.arco if r["user_id"] == uid],
        "nota": "Incluye todo lo que la casa guarda de este equipo. No incluye claves ni accesos. Las cámaras graban en la casa (Frigate) y no se asocian a este equipo.",
    }
    from .audit import log as audit_log  # noqa: PLC0415

    audit_log(hass, "legal", "exportó sus datos", "", f"app · {name}")
    connection.send_result(msg["id"], data)


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/app/arco",
    vol.Required("kind"): vol.In(list(ARCO_KINDS)),
    vol.Optional("detail", default=""): vol.All(str, vol.Length(max=1000)),
})
@callback
def ws_app_arco(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    pv = _rt(hass).get("privacy")
    if pv is None or not _is_app(hass, connection):
        connection.send_error(msg["id"], "unauthorized", "Este usuario no es un equipo de la casa")
        return
    name = _device_label(hass, connection.user.id)
    req = pv.new_request(connection.user.id, msg["kind"], msg["detail"], name)
    from .audit import log as audit_log  # noqa: PLC0415

    audit_log(hass, "legal", f"pedido: {ARCO_KINDS[msg['kind']]}", req["id"], f"app · {name}", msg["detail"][:200])
    connection.send_result(msg["id"], {k: req[k] for k in ("id", "at", "kind", "status")})


# ---------------------------------------------------------------- instalador
@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/privacy/arco_list"})
@websocket_api.require_admin
@callback
def ws_arco_list(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    pv = _rt(hass).get("privacy")
    connection.send_result(msg["id"], {"requests": list(reversed(pv.arco)) if pv else [], "kinds": ARCO_KINDS})


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/privacy/arco_resolve",
    vol.Required("request_id"): str,
    vol.Optional("note", default=""): vol.All(str, vol.Length(max=500)),
})
@websocket_api.require_admin
@callback
def ws_arco_resolve(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    pv = _rt(hass).get("privacy")
    r = pv.resolve(msg["request_id"], msg["note"]) if pv else None
    if r is None:
        connection.send_error(msg["id"], "not_found", "Ese pedido no existe o ya está resuelto")
        return
    from .audit import log as audit_log  # noqa: PLC0415

    audit_log(hass, "legal", f"pedido resuelto: {ARCO_KINDS[r['kind']]}", r["id"], "instalador", msg["note"][:200])
    connection.send_result(msg["id"], r)


WS_COMMANDS = (ws_app_consents, ws_app_export, ws_app_arco, ws_arco_list, ws_arco_resolve)
