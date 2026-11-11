"""Mantenimiento: un Zigbee2MQTT desinstalado deja su «offline» retenido en MQTT y no tiene que hacer reiniciar al que anda."""

from __future__ import annotations

from datetime import timedelta

from homeassistant.util import dt as dt_util

from custom_components.matterai.watchdog import SERVICES, Tracked, Watchdog


def _wd(hass, n_z2m: int) -> Watchdog:
    wd = Watchdog(hass)
    z = next(s for s in SERVICES if s.key == "zigbee2mqtt")
    for i in range(n_z2m):
        key = "zigbee2mqtt" if i == 0 else f"zigbee2mqtt_{i + 1}"
        wd.tracked[key] = Tracked(z, f"45df7312_zigbee2mqtt{'_' + str(i) if i else ''}", "Zigbee2MQTT", key, addon_state="started")
    return wd


async def test_bridge_viejo_no_cuenta(hass) -> None:
    wd = _wd(hass, 1)
    wd.bridges["zigbee2mqtt-green2"] = {"state": "online", "since": dt_util.utcnow()}
    wd.bridges["zigbee2mqtt-mini2"] = {"state": "offline", "since": dt_util.utcnow()}  # retenido de uno que ya no existe
    wd.bridges["zigbee2mqtt-mini2"]["since"] = dt_util.utcnow() - timedelta(hours=5)
    t = wd.tracked["zigbee2mqtt"]
    assert wd._bridge_for(t, 1)["state"] == "online", "el que anda manda; el viejo no hace reiniciar"
    assert list(wd.live_bridges()) == ["zigbee2mqtt-green2"], "y en el panel no aparece el viejo"
    healthy, _why, _act = wd._healthy(t, dt_util.utcnow(), 1)
    assert healthy is True


async def test_el_unico_offline_si_cuenta(hass) -> None:
    wd = _wd(hass, 1)
    wd.bridges["zigbee2mqtt-green2"] = {"state": "offline", "since": dt_util.utcnow()}
    wd.bridges["zigbee2mqtt-mini2"] = {"state": "offline", "since": dt_util.utcnow()}
    wd.bridges["zigbee2mqtt-green2"]["since"] = wd.bridges["zigbee2mqtt-mini2"]["since"] = dt_util.utcnow() - timedelta(hours=1)
    healthy, _why, act = wd._healthy(wd.tracked["zigbee2mqtt"], dt_util.utcnow(), 1)
    assert healthy is False and act == "restart", "NEGATIVO: si el de verdad se cae, se sigue recuperando"


async def test_dos_z2m_uno_caido(hass) -> None:
    wd = _wd(hass, 2)
    wd.bridges["zigbee2mqtt-a"] = {"state": "online", "since": dt_util.utcnow()}
    wd.bridges["zigbee2mqtt-b"] = {"state": "offline", "since": dt_util.utcnow()}
    assert len(wd.live_bridges()) == 2, "con dos complementos, los dos base_topic cuentan"
