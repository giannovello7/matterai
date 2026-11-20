"""Matter y Matter sobre Thread.

- estado_matter: ¿la integración Matter y el Matter Server andan? Para Thread: ¿hay un border router (OTBR de HA o de
  Apple/Google) y una red Thread preferida en la integración Thread de HA?
- comisionar_matter(codigo): equipo ya vinculado a otro ecosistema (Apple Home, Google Home, Alexa, SmartThings) que
  compartió un código: se suma por la red (`commission_with_code`, network_only), sin Bluetooth.
- El código de vinculación nunca se guarda ni se escribe en los logs (ni en los errores).
"""

from __future__ import annotations

import asyncio
import logging
import re
from typing import Any

from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant

from .core import AltaError

_LOGGER = logging.getLogger(__name__)

COMISION_TIMEOUT = 180.0

# Verhoeff: el último dígito del código manual Matter es de control (detecta un número mal copiado)
_D = [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6], [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
      [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1], [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
      [8, 7, 6, 5, 9, 3, 2, 1, 0, 4], [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]]
_P = [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2], [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
      [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1], [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]]
_QR = re.compile(r"^MT:[0-9A-Z.\-]{19,}$")


def verhoeff_ok(num: str) -> bool:
    c = 0
    for i, ch in enumerate(reversed(num)):
        c = _D[c][_P[i % 8][int(ch)]]
    return c == 0


def normalizar_codigo(codigo: str) -> str:
    """«3497-011-2332» → «34970112332»; «MT:Y.K90…» queda igual. AltaError si no es un código Matter válido."""
    raw = str(codigo or "").strip()
    if raw.upper().startswith("MT:"):
        qr = "MT:" + raw[3:].strip()
        if not _QR.match(qr):
            raise AltaError("Ese código QR no parece de Matter. Probá escanearlo de nuevo o escribí el número de 11 dígitos.")
        return qr
    digits = re.sub(r"[\s\-.]", "", raw)
    if not digits.isdigit() or len(digits) not in (11, 21):
        raise AltaError("El código tiene que ser de 11 números (o empezar con MT: si es el del QR).")
    if not verhoeff_ok(digits):
        raise AltaError("Ese código tiene un número mal: revisalo y escribilo de nuevo.")
    return digits


def _cargada(hass: HomeAssistant, domain: str) -> bool:
    return any(e.state is ConfigEntryState.LOADED for e in hass.config_entries.async_entries(domain))


async def _dataset_store(hass: HomeAssistant):
    """La integración Thread de HA (redes guardadas y la preferida), si está."""
    if "thread" not in hass.config.components:
        return None
    from homeassistant.components.thread import dataset_store  # noqa: PLC0415

    return await dataset_store.async_get_store(hass)


async def estado_matter(hass: HomeAssistant) -> dict[str, Any]:
    entries = hass.config_entries.async_entries("matter")
    if not entries:
        matter = {"ok": False, "mensaje": "La casa no tiene la integración Matter. La instala tu instalador (con el complemento Matter Server)."}
    elif not _cargada(hass, "matter"):
        matter = {"ok": False, "mensaje": "El servidor de Matter no está respondiendo. Probá en unos minutos o avisale a tu instalador."}
    else:
        matter = {"ok": True, "mensaje": "Matter está andando."}
    thread: dict[str, Any] = {"ok": False, "red": None, "border_router": None, "faltan": []}
    store = None
    try:
        store = await _dataset_store(hass)
    except Exception:  # noqa: BLE001 - versión de HA sin Thread
        _LOGGER.debug("Alta: no se pudo leer la integración Thread", exc_info=True)
    pref = store.async_get(store.preferred_dataset) if store is not None and store.preferred_dataset else None
    otbr = _cargada(hass, "otbr")
    if pref is not None:
        thread["red"] = getattr(pref, "network_name", None) or "red Thread"
        src = str(getattr(pref, "source", "") or "")
        thread["border_router"] = "el de Home Assistant" if otbr or "OpenThread" in src or "otbr" in src.lower() else (src or "otro equipo")
    elif otbr:
        thread["border_router"] = "el de Home Assistant"
    if pref is None:
        thread["faltan"].append("una red Thread preferida en Home Assistant")
    if not thread["border_router"]:
        thread["faltan"].append("un border router Thread (un coordinador con Thread en Home Assistant, o un HomePod / Nest Hub)")
    thread["ok"] = not thread["faltan"]
    if thread["ok"]:
        thread["mensaje"] = f"Thread listo: red «{thread['red']}» con {thread['border_router']}."
    else:
        thread["mensaje"] = "Para equipos Thread falta " + " y ".join(thread["faltan"]) + "."
    return {"matter": matter, "thread": thread}


def _cliente(hass: HomeAssistant):
    """El cliente del Matter Server que ya usa la integración Matter de HA."""
    from homeassistant.components.matter.helpers import get_matter  # noqa: PLC0415

    return get_matter(hass).matter_client


def _mensaje_error(err: Exception, codigo: str) -> str:
    txt = f"{type(err).__name__} {err}".replace(codigo, "***").lower()
    if isinstance(err, TimeoutError) or "timeout" in txt or "timed out" in txt:
        return "El equipo no respondió. Fijate que esté prendido y cerca, y que el código no haya vencido (dura unos 15 minutos)."
    if "already" in txt or "fabric" in txt:
        return "Ese equipo no acepta otra vinculación. Puede que el código ya se haya usado: generá uno nuevo; si sigue igual, hay que resetearlo de fábrica."
    if "discover" in txt or "not found" in txt:
        return "No encontré el equipo en la red. Tiene que estar en el mismo wifi (o con Thread, al alcance de un border router)."
    return "No se pudo sumar el equipo. Generá un código nuevo en la otra app y probá de nuevo."


async def comisionar_en_red(hass: HomeAssistant, pin: int, ip: str | None = None) -> dict[str, Any]:
    """Equipo nuevo que el celular ya puso en la red y dejó con la ventana de vinculación abierta (PIN temporal)."""
    est = await estado_matter(hass)
    if not est["matter"]["ok"]:
        raise AltaError(est["matter"]["mensaje"])
    try:
        client = _cliente(hass)
    except Exception as err:  # noqa: BLE001
        raise AltaError("El servidor de Matter no está respondiendo.") from err
    kwargs: dict[str, Any] = {"ip_addr": ip} if ip else {}
    try:
        node = await asyncio.wait_for(client.commission_on_network(int(pin), **kwargs), COMISION_TIMEOUT)
    except Exception as err:  # noqa: BLE001
        _LOGGER.info("Alta: no se pudo sumar el equipo Matter del celular (%s)", type(err).__name__)
        raise AltaError(_mensaje_error(err, str(pin))) from None
    return {"node_id": getattr(node, "node_id", None)}


async def thread_red(hass: HomeAssistant) -> dict[str, Any]:
    """La red Thread preferida (TLV) y su border router, para el celular."""
    store = await _dataset_store(hass)
    pref = store.async_get(store.preferred_dataset) if store is not None and store.preferred_dataset else None
    if pref is None:
        raise AltaError("La casa no tiene una red Thread preferida todavía.")
    return {"tlv": pref.tlv, "border_agent_id": getattr(pref, "preferred_border_agent_id", None), "red": getattr(pref, "network_name", None)}


async def comisionar(hass: HomeAssistant, codigo: str, network_only: bool = True) -> dict[str, Any]:
    code = normalizar_codigo(codigo)
    est = await estado_matter(hass)
    if not est["matter"]["ok"]:
        raise AltaError(est["matter"]["mensaje"])
    try:
        client = _cliente(hass)
    except Exception as err:  # noqa: BLE001
        raise AltaError("El servidor de Matter no está respondiendo.") from err
    try:
        node = await asyncio.wait_for(client.commission_with_code(code, network_only=network_only), COMISION_TIMEOUT)
    except AltaError:
        raise
    except Exception as err:  # noqa: BLE001 - errores del Matter Server: mensaje claro (sin el código)
        _LOGGER.info("Alta: no se pudo comisionar el equipo Matter (%s)", type(err).__name__)
        raise AltaError(_mensaje_error(err, code)) from None
    return {"node_id": getattr(node, "node_id", None)}
