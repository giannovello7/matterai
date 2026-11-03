"""Entidades del mantenimiento del sistema (se crean solas para cada servicio detectado).

- switch  «Mantenimiento del sistema»: pausa el watchdog (se apaga solo a la hora).
- binary_sensor «<servicio> funcionando» (problem = está con problemas).
- sensor «<servicio> estado»: ok, recuperando, esperando_hardware, caido, atencion_manual…
- button «Revisar <servicio>»: chequeo inmediato (sin esperar el backoff).
"""

from __future__ import annotations

from typing import Any

from homeassistant.components.binary_sensor import BinarySensorDeviceClass, BinarySensorEntity
from homeassistant.components.button import ButtonEntity
from homeassistant.components.sensor import SensorDeviceClass, SensorEntity
from homeassistant.components.switch import SwitchEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EntityCategory
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity import Entity

from .const import DOMAIN
from .watchdog import MAINTENANCE_DEFAULT, OK, SIGNAL_WATCHDOG, STATE_TEXT, Watchdog


def _wd(hass: HomeAssistant) -> Watchdog | None:
    return hass.data.get(DOMAIN, {}).get("watchdog")


class _Base(Entity):
    _attr_should_poll = False
    _attr_has_entity_name = True

    def __init__(self, entry: ConfigEntry, wd: Watchdog, key: str | None) -> None:
        self.wd = wd
        self.key = key
        self._attr_device_info = DeviceInfo(identifiers={(DOMAIN, f"{entry.entry_id}_system")}, name="Sistema MatterAI",
                                            manufacturer="MatterAI", model="Mantenimiento del sistema")

    @property
    def tracked(self):
        return self.wd.tracked.get(self.key) if self.key else None

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(async_dispatcher_connect(self.hass, SIGNAL_WATCHDOG, self.async_write_ha_state))


class MaintenanceSwitch(_Base, SwitchEntity):
    _attr_icon = "mdi:wrench-clock"
    _attr_name = "Mantenimiento del sistema"
    _attr_entity_category = EntityCategory.CONFIG

    def __init__(self, entry, wd) -> None:
        super().__init__(entry, wd, None)
        self._attr_unique_id = f"{entry.entry_id}_maintenance"

    @property
    def is_on(self) -> bool:
        return self.wd.maintenance

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        until = self.wd.maintenance_until
        return {"hasta": until.isoformat() if until else None}

    async def async_turn_on(self, **kwargs: Any) -> None:
        await self.wd.async_set_maintenance(MAINTENANCE_DEFAULT)

    async def async_turn_off(self, **kwargs: Any) -> None:
        await self.wd.async_set_maintenance(None)


class ServiceOk(_Base, BinarySensorEntity):
    _attr_device_class = BinarySensorDeviceClass.PROBLEM

    def __init__(self, entry, wd, key, name) -> None:
        super().__init__(entry, wd, key)
        self._attr_unique_id = f"{entry.entry_id}_wd_{key}_problem"
        self._attr_name = f"{name} con problemas"

    @property
    def available(self) -> bool:
        return self.tracked is not None

    @property
    def is_on(self) -> bool:
        t = self.tracked
        return bool(t and t.status not in (OK,) and t.status != "sin_datos" and t.status != "mantenimiento")


class ServiceStatus(_Base, SensorEntity):
    _attr_device_class = SensorDeviceClass.ENUM
    _attr_options = list(STATE_TEXT)
    _attr_icon = "mdi:shield-sync-outline"

    def __init__(self, entry, wd, key, name) -> None:
        super().__init__(entry, wd, key)
        self._attr_unique_id = f"{entry.entry_id}_wd_{key}_status"
        self._attr_name = f"{name} estado"

    @property
    def available(self) -> bool:
        return self.tracked is not None

    @property
    def native_value(self) -> str | None:
        t = self.tracked
        return t.status if t else None

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        t = self.tracked
        if not t:
            return {}
        s = self.wd.data["services"].get(t.key, {})
        return {
            "detalle": t.detail, "complemento": t.slug, "estado_complemento": t.addon_state, "version": t.version,
            "caido_desde": s.get("down_since"), "intentos": s.get("attempts", 0), "ultima_accion": s.get("last_action"),
            "ultima_accion_el": s.get("last_action_at"), "reinicios_automaticos": s.get("restarts", 0),
        }


class ServiceCheck(_Base, ButtonEntity):
    _attr_icon = "mdi:magnify-scan"
    _attr_entity_category = EntityCategory.DIAGNOSTIC

    def __init__(self, entry, wd, key, name) -> None:
        super().__init__(entry, wd, key)
        self._attr_unique_id = f"{entry.entry_id}_wd_{key}_check"
        self._attr_name = f"Revisar {name}"

    async def async_press(self) -> None:
        await self.wd.async_check(force=True)


FACTORIES = {"binary_sensor": ServiceOk, "sensor": ServiceStatus, "button": ServiceCheck}


@callback
def async_setup_watchdog_platform(hass: HomeAssistant, entry: ConfigEntry, async_add_entities, platform: str) -> None:
    """Agrega las entidades de este tipo; las de servicios nuevos aparecen cuando el watchdog los detecta."""
    wd = _wd(hass)
    if wd is None:
        return
    if platform == "switch":
        async_add_entities([MaintenanceSwitch(entry, wd)])
        return
    factory = FACTORIES.get(platform)
    if factory is None:
        return
    known: set[str] = set()

    @callback
    def _sync() -> None:
        new = [factory(entry, wd, key, t.sdef.name if not key[-1].isdigit() else t.name) for key, t in wd.tracked.items() if key not in known]
        for ent in new:
            known.add(ent.key)
        if new:
            async_add_entities(new)

    _sync()
    entry.async_on_unload(async_dispatcher_connect(hass, SIGNAL_WATCHDOG, _sync))
