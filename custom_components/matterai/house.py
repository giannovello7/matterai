"""La casa: usuario de la app de los clientes, su acceso y el link/QR de vinculación."""

from __future__ import annotations

import base64
from datetime import timedelta
import json
import logging
import secrets
from typing import Any

from homeassistant.auth.const import GROUP_ID_USER
from homeassistant.auth.models import TOKEN_TYPE_LONG_LIVED_ACCESS_TOKEN
from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import APP_CLIENT_NAME, APP_USER_NAME, STORAGE_HOUSE_KEY, STORAGE_VERSION

_LOGGER = logging.getLogger(__name__)

APP_URL = "https://app.matterai.com.ar/"
TOKEN_DAYS = 3650  # el cliente no tiene que volver a vincular nunca (se revoca desde el panel)


def encode_pairing(data: dict[str, Any]) -> str:
    """Mismo formato que la app (`encodePairing` en app/ha.js): JSON en base64url."""
    clean = {k: v for k, v in data.items() if v not in (None, "")}
    clean.setdefault("n", "")
    raw = json.dumps(clean, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


class House:
    """Datos que la integración guarda de esta casa (privados: van a .storage)."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORAGE_HOUSE_KEY, private=True)
        self.data: dict[str, Any] = {}

    async def async_load(self) -> None:
        self.data = await self._store.async_load() or {}
        if not self.data.get("house_id"):
            self.data["house_id"] = secrets.token_hex(8)
            await self._store.async_save(self.data)

    @property
    def house_id(self) -> str:
        return self.data["house_id"]

    async def _save(self) -> None:
        await self._store.async_save(self.data)

    async def async_app_user(self):
        """El usuario de la app: lo crea si no existe (sin administrador, como pide la app)."""
        auth = self.hass.auth
        user = await auth.async_get_user(self.data["user_id"]) if self.data.get("user_id") else None
        if user is None:
            # si ya había uno con el mismo nombre (instalación anterior), se reutiliza
            for u in await auth.async_get_users():
                if u.name == APP_USER_NAME and not u.system_generated and not u.is_owner:
                    user = u
                    break
        if user is None:
            user = await auth.async_create_user(APP_USER_NAME, group_ids=[GROUP_ID_USER], local_only=False)
            _LOGGER.info("Creado el usuario «%s» para la app de los clientes", APP_USER_NAME)
        if not user.is_active:
            await auth.async_activate_user(user)
        if self.data.get("user_id") != user.id:
            self.data["user_id"] = user.id
            self.data.pop("token", None)
            self.data.pop("refresh_id", None)
            await self._save()
        return user

    async def async_token(self) -> str:
        """El acceso de la app (de larga duración). Si se borró en HA, se crea otro."""
        user = await self.async_app_user()
        rt = self.hass.auth.async_get_refresh_token(self.data["refresh_id"]) if self.data.get("refresh_id") else None
        if rt is None or rt.user.id != user.id or not self.data.get("token"):
            await self._async_new_token(user)
        return self.data["token"]

    async def async_regenerate(self) -> str:
        """Nuevo acceso: el anterior deja de funcionar (por ejemplo, si un cliente perdió el celular)."""
        user = await self.async_app_user()
        old = self.hass.auth.async_get_refresh_token(self.data["refresh_id"]) if self.data.get("refresh_id") else None
        if old is not None:
            self.hass.auth.async_remove_refresh_token(old)
        await self._async_new_token(user)
        return self.data["token"]

    async def _async_new_token(self, user) -> None:
        # HA no deja repetir el nombre de un token de larga duración: se le agrega la fecha
        name = f"{APP_CLIENT_NAME} {secrets.token_hex(3)}"
        rt = await self.hass.auth.async_create_refresh_token(
            user,
            client_name=name,
            token_type=TOKEN_TYPE_LONG_LIVED_ACCESS_TOKEN,
            access_token_expiration=timedelta(days=TOKEN_DAYS),
        )
        self.data["refresh_id"] = rt.id
        self.data["token"] = self.hass.auth.async_create_access_token(rt)
        await self._save()

    async def async_pairing(self, url: str, name: str, support: str | None, local: str = "", wifi: str = "") -> dict[str, Any]:
        """Link y código para vincular el celular del cliente (lo que antes hacía instalador/vincular.html).

        Con dirección local, la app nativa se conecta directo a la casa cuando el celular está en su wifi
        (como la app de Home Assistant) y por la dirección remota cuando está afuera."""
        token = await self.async_token()
        nets = [w.strip() for w in (wifi or "").split(",") if w.strip()]
        code = encode_pairing({"u": url.rstrip("/"), "t": token, "n": name, "s": support or None,
                               "l": (local or "").rstrip("/") or None, "w": nets or None})
        return {"code": code, "link": f"{APP_URL}#v={code}", "url": url.rstrip("/"), "name": name}
