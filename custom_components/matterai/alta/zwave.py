"""Z-Wave (integración Z-Wave JS de HA): incluir, PIN de seguridad S2, QR SmartStart y excluir.

- Incluir: el controlador busca equipos por un tiempo limitado (máx. 254 s, como Zigbee) y se para solo.
  Seguridad S2: se conceden las clases que pide el equipo y, si pide el PIN, la app/Matte se lo pide al cliente
  (los 5 primeros números del código DSK, impreso en el equipo o en la caja).
- QR SmartStart: el equipo queda anotado y se une solo apenas se le pone corriente.
- Excluir: para un equipo que estuvo en otra red Z-Wave (si no, no se une). Equivale al «reset» de Zigbee.
- El PIN y el QR no se guardan ni van a los logs.
"""

from __future__ import annotations

import asyncio
from collections.abc import Callable
import logging
import re
from typing import Any

from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.event import async_call_later

from .core import AltaError

_LOGGER = logging.getLogger(__name__)

PIN_TIMEOUT = 240.0
_QR = re.compile(r"^90\d{50,}$")


def entrada(hass: HomeAssistant):
    return next((e for e in hass.config_entries.async_entries("zwave_js") if e.state is ConfigEntryState.LOADED), None)


def _client(hass: HomeAssistant):
    """El cliente del servidor Z-Wave JS que ya usa la integración de HA."""
    e = entrada(hass)
    if e is None:
        raise AltaError("La casa no tiene Z-Wave andando.")
    rd = getattr(e, "runtime_data", None)
    client = rd.get("client") if isinstance(rd, dict) else getattr(rd, "client", None)
    if client is None:  # versiones de HA anteriores
        client = ((hass.data.get("zwave_js") or {}).get(e.entry_id) or {}).get("client")
    if client is None or client.driver is None:
        raise AltaError("El servidor de Z-Wave no está respondiendo.")
    return client


async def _parse_qr(client, code: str):
    from homeassistant.components.zwave_js.api import async_parse_qr_code_string  # noqa: PLC0415

    return await async_parse_qr_code_string(client, code)


def _estrategia_default() -> Any:
    try:
        from zwave_js_server.const import InclusionStrategy  # noqa: PLC0415

        return InclusionStrategy.DEFAULT
    except ImportError:  # sin la librería (pruebas)
        return 0


class ZWave:
    """La parte Z-Wave de una sesión de alta."""

    def __init__(self, alta) -> None:
        self.alta = alta
        self.hass: HomeAssistant = alta.hass
        self.incluyendo = False
        self.excluyendo = False
        self.dsk: str | None = None  # el equipo pide el PIN: se muestra la parte conocida del código
        self._unsubs: list[Callable[[], None]] = []
        self._timer: Callable[[], None] | None = None
        self._excluido: asyncio.Future | None = None

    def disponible(self) -> bool:
        return entrada(self.hass) is not None

    def _limpiar(self) -> None:
        for u in self._unsubs:
            try:
                u()
            except Exception:  # noqa: BLE001
                pass
        self._unsubs.clear()
        if self._timer:
            self._timer()
            self._timer = None

    # ------------------------------------------------------------ incluir
    async def incluir(self, segundos: int) -> None:
        ctrl = _client(self.hass).driver.controller
        self._limpiar()
        self._unsubs += [
            ctrl.on("grant security classes", self._conceder),
            ctrl.on("validate dsk and enter pin", self._pide_pin),
            ctrl.on("node added", self._agregado),
            ctrl.on("inclusion stopped", self._parado),
            ctrl.on("inclusion failed", self._fallo),
        ]
        try:
            await ctrl.async_begin_inclusion(_estrategia_default())
        except Exception as err:  # noqa: BLE001
            self._limpiar()
            _LOGGER.info("Alta: Z-Wave no aceptó incluir (%s)", type(err).__name__)
            raise AltaError("Z-Wave no aceptó buscar equipos. Puede que ya esté buscando: probá en un minuto.") from None
        self.incluyendo = True
        self._timer = async_call_later(self.hass, segundos, self._vencio)

    async def parar(self) -> None:
        if not self.incluyendo and not self.excluyendo:
            self._limpiar()
            return
        try:
            ctrl = _client(self.hass).driver.controller
            if self.incluyendo:
                await ctrl.async_stop_inclusion()
            if self.excluyendo:
                await ctrl.async_stop_exclusion()
        except Exception:  # noqa: BLE001 - ya se había parado
            _LOGGER.debug("Alta: Z-Wave ya estaba parado", exc_info=True)
        self.incluyendo = self.excluyendo = False
        self.dsk = None
        self._limpiar()

    async def _vencio(self, _now=None) -> None:
        self._timer = None
        await self.parar()

    @callback
    def _conceder(self, event: dict) -> None:
        """S2: se conceden las clases de seguridad que pide el equipo (como «por defecto» en HA)."""
        requested = event.get("requested_grant") if isinstance(event, dict) else None
        if requested is None:
            return
        self.hass.async_create_background_task(self._grant(requested), "matterai_zwave_grant")

    async def _grant(self, requested) -> None:
        try:
            await _client(self.hass).driver.controller.async_grant_security_classes(requested)
        except Exception:  # noqa: BLE001
            _LOGGER.info("Alta: Z-Wave no aceptó la seguridad S2")

    @callback
    def _pide_pin(self, event: dict) -> None:
        self.dsk = str((event or {}).get("dsk") or "")
        self.alta._set("pide_pin", "El equipo pide su PIN: los 5 primeros números del código impreso (DSK)")  # noqa: SLF001

    @callback
    def _agregado(self, event: dict) -> None:
        self.dsk = None
        self.alta._set("configurando", "Configurando el equipo…")  # noqa: SLF001

    @callback
    def _parado(self, _event: dict) -> None:
        self.incluyendo = False
        self.dsk = None

    @callback
    def _fallo(self, _event: dict) -> None:
        self.incluyendo = False
        self.alta._resolver({"encontrado": False, "error": "configuracion",  # noqa: SLF001
                             "mensaje": "El equipo Z-Wave no terminó de unirse. Probá excluirlo primero (por si estuvo en otra red) y volvé a intentar."})

    async def pin(self, pin: str) -> None:
        pin = re.sub(r"\D", "", str(pin or ""))
        if len(pin) != 5:
            raise AltaError("El PIN son los 5 primeros números del código del equipo (DSK), impresos en el equipo o en la caja.")
        if self.dsk is None:
            raise AltaError("El equipo no está pidiendo el PIN ahora.")
        try:
            await _client(self.hass).driver.controller.async_validate_dsk_and_enter_pin(pin)
        except Exception:  # noqa: BLE001 - sin el PIN en el mensaje
            raise AltaError("No se pudo validar el PIN. Revisalo y probá de nuevo.") from None
        self.dsk = None
        self.alta._set("configurando", "Configurando el equipo…")  # noqa: SLF001

    # ------------------------------------------------------------ QR SmartStart
    async def qr(self, codigo: str) -> None:
        code = re.sub(r"\s", "", str(codigo or ""))
        if not _QR.match(code):
            raise AltaError("Ese no parece un QR de Z-Wave (empieza con 90 y es un número largo). Escanealo de nuevo.")
        client = _client(self.hass)
        try:
            info = await _parse_qr(client, code)
            await client.driver.controller.async_provision_smart_start_node(info)
        except AltaError:
            raise
        except Exception as err:  # noqa: BLE001
            _LOGGER.info("Alta: no se pudo anotar el QR Z-Wave (%s)", type(err).__name__)
            raise AltaError("No se pudo usar ese QR. Probá escanearlo de nuevo o sumá el equipo con «buscar equipos».") from None

    # ------------------------------------------------------------ excluir
    async def excluir(self, segundos: int) -> dict[str, Any]:
        ctrl = _client(self.hass).driver.controller
        self._limpiar()
        self._excluido = self.hass.loop.create_future()

        @callback
        def _removed(event: dict) -> None:
            if self._excluido and not self._excluido.done():
                self._excluido.set_result(True)

        self._unsubs.append(ctrl.on("node removed", _removed))
        try:
            await ctrl.async_begin_exclusion()
        except Exception:  # noqa: BLE001
            self._limpiar()
            raise AltaError("Z-Wave no aceptó excluir ahora. Probá en un minuto.") from None
        self.excluyendo = True
        try:
            ok = await asyncio.wait_for(self._excluido, segundos)
        except TimeoutError:
            ok = False
        await self.parar()
        return {"excluido": bool(ok), "mensaje": "Listo, el equipo quedó libre: ahora sí se puede agregar." if ok
                else "No se excluyó ningún equipo. Fijate cómo se resetea (en general, el mismo botón que para agregarlo)."}
