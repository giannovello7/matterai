"""Imágenes de los dashboards (render de la casa: apagado, prendido, de día).

- Subir: POST /api/matterai/media (sólo el instalador), multipart con el campo «file». JPG, PNG o WebP, hasta 12 MB.
  Se revisa que el contenido sea de verdad una imagen (no alcanza con la extensión).
- Ver: GET /api/matterai/media/<id>.<ext> con usuario de la casa: la app pide un link firmado (auth/sign_path)
  para usarlo en <img>. Nunca quedan públicas (no van a /local).
- Se guardan en <config>/matterai_media/ con un nombre al azar. matterai/media/list y media/delete (instalador).
"""

from __future__ import annotations

import logging
import os
import re
import secrets
from typing import Any

from aiohttp import web
import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.components.http import HomeAssistantView
from homeassistant.core import HomeAssistant, callback

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

MEDIA_DIR = "matterai_media"
MAX_BYTES = 12 * 1024 * 1024
NAME_RE = re.compile(r"^[a-f0-9]{16}\.(jpg|png|webp)$")
TYPES = {"jpg": "image/jpeg", "png": "image/png", "webp": "image/webp"}


def _kind(head: bytes) -> str | None:
    """Tipo real del archivo por su cabecera (magic bytes)."""
    if head[:3] == b"\xff\xd8\xff":
        return "jpg"
    if head[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "webp"
    return None


def media_dir(hass: HomeAssistant) -> str:
    return hass.config.path(MEDIA_DIR)


class MediaUploadView(HomeAssistantView):
    url = "/api/matterai/media"
    name = f"api:{DOMAIN}:media_upload"
    requires_auth = True

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass

    async def post(self, request: web.Request) -> web.Response:
        user = request["hass_user"]
        if not user.is_admin:
            return self.json({"ok": False, "msg": "Sólo el instalador puede subir imágenes"}, status_code=403)
        try:
            reader = await request.multipart()
            field = await reader.next()
        except Exception:  # noqa: BLE001 - no vino como formulario
            field = None
        if field is None or getattr(field, "name", None) != "file":
            return self.json({"ok": False, "msg": "Falta el archivo"}, status_code=400)
        data = bytearray()
        while True:
            chunk = await field.read_chunk(256 * 1024)
            if not chunk:
                break
            data.extend(chunk)
            if len(data) > MAX_BYTES:
                return self.json({"ok": False, "msg": "La imagen es demasiado grande (máximo 12 MB)"}, status_code=413)
        kind = _kind(bytes(data[:16]))
        if kind is None:
            return self.json({"ok": False, "msg": "Tiene que ser una imagen JPG, PNG o WebP"}, status_code=415)
        name = f"{secrets.token_hex(8)}.{kind}"

        def _write() -> None:
            os.makedirs(media_dir(self.hass), exist_ok=True)
            with open(os.path.join(media_dir(self.hass), name), "wb") as f:
                f.write(data)

        await self.hass.async_add_executor_job(_write)
        _LOGGER.info("Imagen de dashboard subida: %s (%d KB)", name, len(data) // 1024)
        return self.json({"ok": True, "path": f"/api/matterai/media/{name}", "size": len(data)})


class MediaView(HomeAssistantView):
    url = "/api/matterai/media/{name}"
    name = f"api:{DOMAIN}:media"
    requires_auth = True  # con usuario o con link firmado (auth/sign_path)

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass

    async def get(self, request: web.Request, name: str) -> web.StreamResponse:
        if not NAME_RE.match(name):  # nada de «../» ni otras rutas
            return web.Response(status=404)
        path = os.path.join(media_dir(self.hass), name)
        if not await self.hass.async_add_executor_job(os.path.isfile, path):
            return web.Response(status=404)
        return web.FileResponse(path, headers={"Content-Type": TYPES[name.rsplit(".", 1)[1]], "Cache-Control": "private, max-age=86400",
                                               "X-Content-Type-Options": "nosniff"})


@callback
def async_register_views(hass: HomeAssistant) -> None:
    flag = f"{DOMAIN}_media_views"
    if not hass.data.get(flag):
        hass.http.register_view(MediaUploadView(hass))
        hass.http.register_view(MediaView(hass))
        hass.data[flag] = True


def _list(hass: HomeAssistant) -> list[dict[str, Any]]:
    d = media_dir(hass)
    if not os.path.isdir(d):
        return []
    out = []
    for n in sorted(os.listdir(d)):
        if NAME_RE.match(n):
            out.append({"path": f"/api/matterai/media/{n}", "size": os.path.getsize(os.path.join(d, n))})
    return out


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/media/list"})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_media_list(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    connection.send_result(msg["id"], {"media": await hass.async_add_executor_job(_list, hass)})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/media/delete", vol.Required("path"): str})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_media_delete(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    name = msg["path"].rsplit("/", 1)[-1]
    if not NAME_RE.match(name):
        connection.send_error(msg["id"], "invalid", "Imagen inválida")
        return
    path = os.path.join(media_dir(hass), name)
    if await hass.async_add_executor_job(os.path.isfile, path):
        await hass.async_add_executor_job(os.remove, path)
    connection.send_result(msg["id"], {"ok": True})


WS_COMMANDS = (ws_media_list, ws_media_delete)
