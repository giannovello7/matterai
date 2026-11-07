"""La casa: acceso de los celulares a la casa y el link/QR de vinculación.

Desde la 2.10 cada celular o tablet tiene su propio usuario de Home Assistant (no administrador) con su
propio acceso, así se puede desvincular uno solo (si se pierde un celular) y se sabe quién hizo cada cosa.

- El link / QR de vinculación lleva un **código de un solo uso** (vence en CODE_HOURS), nunca el acceso.
  La app lo canjea en /api/matterai/pair por el acceso de ese equipo.
- Desde la app, un equipo ya vinculado puede generar otro código («Agregar otro celular»).
- Los equipos vinculados con la versión anterior (un acceso compartido por todos) se pasan solos a su
  propio acceso la próxima vez que abren la app (matterai/app/upgrade). Cuando no queda ninguno,
  el instalador apaga el acceso compartido.
- El acceso no vence: el cliente no tiene que volver a entrar nunca. Se corta sólo al desvincular.
"""

from __future__ import annotations

import base64
from datetime import timedelta
import hashlib
import json
import logging
import secrets
import time
from typing import Any

from homeassistant.auth.const import GROUP_ID_USER
from homeassistant.auth.models import TOKEN_TYPE_LONG_LIVED_ACCESS_TOKEN
from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import APP_CLIENT_NAME, APP_USER_NAME, STORAGE_HOUSE_KEY, STORAGE_VERSION

_LOGGER = logging.getLogger(__name__)

APP_URL = "https://app.matterai.com.ar/"
TOKEN_DAYS = 3650  # el cliente no tiene que volver a vincular nunca (se corta al desvincular el equipo)
CODE_HOURS = 24  # un código de vinculación sirve una sola vez y vence a las 24 h
MAX_CODES = 30
DEVICE_PREFIX = "App · "


def encode_pairing(data: dict[str, Any]) -> str:
    """Mismo formato que la app (`encodePairing` en app/ha.js): JSON en base64url."""
    clean = {k: v for k, v in data.items() if v not in (None, "")}
    clean.setdefault("n", "")
    raw = json.dumps(clean, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _hash(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def _install_hash(install: Any) -> str | None:
    """Huella de la instalación de la app (la app manda un número al azar; se guarda sólo su hash)."""
    if not isinstance(install, str) or not 16 <= len(install) <= 128:
        return None
    return hashlib.sha256(f"mae-install:{install}".encode()).hexdigest()[:32]


def _clean_name(name: Any) -> str:
    text = " ".join(str(name or "").split())[:40]
    return text or "Celular"


class House:
    """Datos que la integración guarda de esta casa (privados: van a .storage)."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORAGE_HOUSE_KEY, private=True)
        self.data: dict[str, Any] = {}

    async def async_load(self) -> None:
        self.data = await self._store.async_load() or {}
        changed = False
        if not self.data.get("house_id"):
            self.data["house_id"] = secrets.token_hex(8)
            changed = True
        if not self.data.get("run_key"):
            # firma de los accesos rápidos y stickers NFC de esta casa (los equipos la reciben al conectarse)
            self.data["run_key"] = secrets.token_urlsafe(32)
            changed = True
        if changed:
            await self._save()

    @property
    def house_id(self) -> str:
        return self.data["house_id"]

    @property
    def run_key(self) -> str:
        return self.data["run_key"]

    async def _save(self) -> None:
        await self._store.async_save(self.data)

    # ------------------------------------------------------------ equipos
    @property
    def devices(self) -> dict[str, dict[str, Any]]:
        return self.data.setdefault("devices", {})

    def is_device_user(self, user_id: str | None) -> bool:
        return bool(user_id) and user_id in self.devices

    def is_shared_user(self, user_id: str | None) -> bool:
        return bool(user_id) and user_id == self.data.get("user_id")

    def is_app_user(self, user_id: str | None) -> bool:
        return self.is_device_user(user_id) or self.is_shared_user(user_id)

    def twins(self, user_id: str) -> list[str]:
        """Otros vínculos del mismo equipo (misma instalación de la app): los viejos, que hay que reemplazar."""
        ih = (self.devices.get(user_id) or {}).get("install")
        return [u for u, d in self.devices.items() if ih and u != user_id and d.get("install") == ih]

    async def _async_new_device(self, name: str, via: str, by: str | None, install: str | None = None,
                                guest: dict[str, Any] | None = None) -> tuple[str, str]:
        """Usuario + acceso de un equipo. Devuelve (user_id, token)."""
        auth = self.hass.auth
        name = _clean_name(name)
        user = await auth.async_create_user(f"{DEVICE_PREFIX}{name}", group_ids=[GROUP_ID_USER], local_only=False)
        rt = await auth.async_create_refresh_token(
            user,
            client_name=f"{APP_CLIENT_NAME} {secrets.token_hex(3)}",
            token_type=TOKEN_TYPE_LONG_LIVED_ACCESS_TOKEN,
            access_token_expiration=timedelta(days=TOKEN_DAYS),
        )
        token = auth.async_create_access_token(rt)
        self.devices[user.id] = {"name": name, "created": time.time(), "via": via, "by": by, "refresh_id": rt.id}
        if guest:
            # invitado: el acceso se corta solo al vencer (ver pairing.async_expire_guests)
            self.devices[user.id]["until"] = float(guest["until"])
            if guest.get("profile"):
                self.devices[user.id]["profile"] = guest["profile"]
        ih = _install_hash(install)
        if ih:
            self.devices[user.id]["install"] = ih
        await self._save()
        _LOGGER.info("Vinculado el equipo «%s» (%s)", name, via)
        return user.id, token

    async def async_revoke(self, user_id: str) -> bool:
        """Desvincula un equipo: borra su usuario (y con él su acceso). Sus otros datos los limpia quien llama."""
        if user_id not in self.devices:
            return False
        user = await self.hass.auth.async_get_user(user_id)
        if user is not None and not user.is_owner and not user.is_admin:
            await self.hass.auth.async_remove_user(user)
        info = self.devices.pop(user_id)
        await self._save()
        _LOGGER.info("Desvinculado el equipo «%s»", info.get("name"))
        return True

    def listing(self) -> list[dict[str, Any]]:
        out = []
        for uid, d in self.devices.items():
            rt = self.hass.auth.async_get_refresh_token(d.get("refresh_id") or "")
            last = rt.last_used_at.timestamp() if rt and rt.last_used_at else None
            out.append({"user_id": uid, "name": d.get("name"), "created": d.get("created"), "via": d.get("via"), "last_used": last,
                        "install": bool(d.get("install")), "until": d.get("until"), "profile": d.get("profile")})
        return sorted(out, key=lambda x: x.get("created") or 0)

    def expired(self) -> list[str]:
        """Invitados con el acceso vencido."""
        now = time.time()
        return [u for u, d in self.devices.items() if d.get("until") and d["until"] <= now]

    def device_profile(self, user_id: str | None) -> str | None:
        """El perfil con el que se vinculó el equipo (invitados), si el instalador no le eligió otro."""
        return (self.devices.get(user_id or "") or {}).get("profile")

    # ------------------------------------------------------------ códigos de vinculación
    def _codes(self) -> dict[str, dict[str, Any]]:
        now = time.time()
        codes = {h: c for h, c in (self.data.get("codes") or {}).items() if c.get("exp", 0) > now}
        self.data["codes"] = codes
        return codes

    async def async_new_code(self, by: str | None = None, guest: dict[str, Any] | None = None) -> tuple[str, float]:
        codes = self._codes()
        while len(codes) >= MAX_CODES:  # no crece sin límite: se descarta el más viejo
            codes.pop(min(codes, key=lambda h: codes[h]["exp"]))
        code = secrets.token_urlsafe(18)
        exp = time.time() + CODE_HOURS * 3600
        codes[_hash(code)] = {"exp": exp, "by": by}
        if guest:
            codes[_hash(code)]["guest"] = guest
        await self._save()
        return code, exp

    async def async_redeem(self, code: str, name: str, install: str | None = None) -> tuple[str, str] | None:
        """Canjea un código de un solo uso por el acceso de un equipo nuevo. None si no sirve."""
        if not code or len(code) > 64:
            return None
        codes = self._codes()
        hit = codes.pop(_hash(code), None)
        if hit is None:
            return None
        await self._save()  # de un solo uso: se borra antes de crear el acceso
        guest = hit.get("guest") if isinstance(hit.get("guest"), dict) else None
        if guest and float(guest.get("until") or 0) <= time.time():
            return None  # el acceso de invitado ya venció antes de usarse
        return await self._async_new_device(name, "guest" if guest else "invite" if hit.get("by") else "pair", hit.get("by"), install, guest)

    async def async_upgrade(self, user_id: str, name: str, install: str | None = None) -> tuple[str, str] | None:
        """Un equipo con el acceso compartido (versión anterior) pasa a tener el suyo."""
        if not self.is_shared_user(user_id) or self.data.get("shared_off"):
            return None
        return await self._async_new_device(name, "upgrade", None, install)

    # ------------------------------------------------------------ acceso compartido (versión anterior)
    async def async_shared_off(self) -> bool:
        """Apaga el acceso compartido de la versión anterior (los equipos que no se pasaron quedan afuera)."""
        auth = self.hass.auth
        user = await auth.async_get_user(self.data["user_id"]) if self.data.get("user_id") else None
        if user is not None and not user.is_owner and not user.is_admin:
            await auth.async_remove_user(user)
        for key in ("user_id", "token", "refresh_id"):
            self.data.pop(key, None)
        self.data["shared_off"] = True
        await self._save()
        _LOGGER.info("Apagado el acceso compartido de la app")
        return True

    def shared_status(self) -> dict[str, Any]:
        if self.data.get("shared_off") or not self.data.get("user_id"):
            return {"active": False}
        rt = self.hass.auth.async_get_refresh_token(self.data.get("refresh_id") or "")
        return {"active": rt is not None, "last_used": rt.last_used_at.timestamp() if rt and rt.last_used_at else None}

    async def async_pairing(self, url: str, name: str, support: str | None, local: str = "", wifi: str = "", by: str | None = None,
                            guest: dict[str, Any] | None = None) -> dict[str, Any]:
        """Link y QR para vincular un celular: llevan un código de un solo uso, nunca el acceso.

        Con dirección local, la app nativa se conecta directo a la casa cuando el celular está en su wifi
        (como la app de Home Assistant) y por la dirección remota cuando está afuera."""
        code, exp = await self.async_new_code(by, guest)
        nets = [w.strip() for w in (wifi or "").split(",") if w.strip()]
        payload = encode_pairing({"u": url.rstrip("/"), "c": code, "n": name, "s": support or None,
                                  "l": (local or "").rstrip("/") or None, "w": nets or None})
        return {"code": payload, "link": f"{APP_URL}#v={payload}", "url": url.rstrip("/"), "name": name,
                "expires": min(exp, guest["until"]) if guest else exp, "hours": CODE_HOURS, "guest": guest}


__all__ = ["APP_USER_NAME", "House"]
