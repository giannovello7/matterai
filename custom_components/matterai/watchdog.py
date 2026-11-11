"""Mantenimiento del sistema: cuida los servicios críticos de la casa y los recupera solos.

Viene incluido en MatterAI y se configura solo: al arrancar detecta qué complementos tiene la
casa (Zigbee2MQTT, Mosquitto, …) y los vigila. No hace falta copiar automatizaciones YAML.

Cómo decide (cada minuto, y al momento si Zigbee2MQTT avisa que se desconectó):
- Cloudflared: además de que el complemento ande, la casa prueba su propia dirección externa
  pasando por Cloudflare. Si Cloudflare contesta que el túnel no está conectado (5xx, como el
  error 1033) durante 3 minutos, se reinicia. Si la casa no tiene internet, no se toca: esperar.
- La fuente de verdad es el Supervisor: el estado real del complemento (started / stopped / error).
- Zigbee2MQTT además tiene que estar «online» en MQTT (<base_topic>/bridge/state). El base_topic
  se descubre solo escuchando MQTT. Si está andando pero offline más de 3 minutos, se reinicia.
- Primero se recuperan las dependencias (Mosquitto antes que Zigbee2MQTT).
- Si el coordinador Zigbee (SLZB-06 / SMLIGHT) no responde, no se reinicia Zigbee2MQTT: no
  serviría. Se espera y se avisa.
- Backoff entre intentos (1 → 2 → 5 → 15 → 30 → 60 min) y nunca dos acciones a la vez sobre el
  mismo servicio. Después de 6 intentos sin éxito queda en «atención manual» y reintenta cada hora.
- El estado se guarda (Store): un reinicio de HA no olvida que un servicio estaba caído.
- Si falla justo después de una actualización del complemento, el aviso lo dice.
- Modo mantenimiento: pausa todo (por ejemplo para actualizar el firmware del SLZB-06); se apaga
  solo a la hora y hace un chequeo.

Integraciones (no son complementos: se recargan, no se reinician; andan también sin Supervisor):
- Cualquier integración que quedó sin arrancar (error al iniciar, «no cargada», o reintentando
  más de 3 minutos) se recarga sola pasados los 2 minutos de iniciado HA, con el mismo backoff.
  Es el caso típico de TTLock: HA arranca antes que la red/DNS, la integración falla una vez y
  queda así hasta que alguien la recarga. Las que piden volver a iniciar sesión no se tocan.
- Las integraciones de nube que se «cuelgan» (TTLock, Tuya, Smart Life, eWeLink) además se
  recargan si TODOS sus equipos quedan no disponibles 3 minutos. Esto no se hace con cualquier
  integración a propósito: una tele apagada también figura «no disponible».

Los avisos salen por el mismo camino que el resto (health.py → panel central → Telegram) y además
se crea un aviso en Reparaciones si un servicio sigue caído más de 20 minutos.
"""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
import json
import logging
from typing import Any

from homeassistant.config_entries import SOURCE_IGNORE, SOURCE_REAUTH, ConfigEntry, ConfigEntryState
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers import issue_registry as ir
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.event import async_call_later, async_track_time_interval
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import CONF_URL, DOMAIN

_LOGGER = logging.getLogger(__name__)

SIGNAL_WATCHDOG = f"{DOMAIN}_watchdog"
STORE_KEY = f"{DOMAIN}.watchdog"
CHECK_EVERY = timedelta(minutes=1)
START_GRACE = timedelta(minutes=2)  # al iniciar HA todo está levantando
OFFLINE_FOR = timedelta(minutes=3)  # Z2M «offline» sostenido antes de reiniciar
NO_BRIDGE_FOR = timedelta(minutes=10)  # andando pero sin publicar nunca su estado
BACKOFF = [60, 120, 300, 900, 1800, 3600]  # segundos entre intentos
MANUAL_AFTER = 6  # intentos sin éxito → atención manual (reintenta cada hora)
ALERT_AFTER = timedelta(minutes=5)  # recién ahí va al panel central (que espera otros 10 min)
REPAIR_AFTER = timedelta(minutes=20)
UPDATE_RECENT = timedelta(hours=24)
MAINTENANCE_DEFAULT = 60  # minutos

OK, RECOVERING, WAIT_HW, WAIT_DEP, DOWN, MANUAL, MAINT, UNKNOWN = (
    "ok", "recuperando", "esperando_hardware", "esperando_dependencia", "caido", "atencion_manual", "mantenimiento", "sin_datos")
STATE_TEXT = {
    OK: "Funcionando", RECOVERING: "Recuperando", WAIT_HW: "Esperando al coordinador", WAIT_DEP: "Esperando a otro servicio",
    DOWN: "Caído", MANUAL: "Necesita atención manual", MAINT: "En mantenimiento", UNKNOWN: "Sin datos",
}


def _never(_slug: str) -> bool:
    return False


@dataclass
class ServiceDef:
    """Un tipo de servicio que MatterAI sabe cuidar."""

    key: str
    name: str
    match: Callable[[str], bool] = _never  # ¿este slug de complemento es de este servicio?
    depends: tuple[str, ...] = ()
    mqtt_bridge: bool = False  # Zigbee2MQTT: <base>/bridge/state
    remote_probe: bool = False  # Cloudflared: la dirección externa de la casa tiene que responder
    coordinator: bool = False  # depende del coordinador Zigbee de red (SLZB-06 / SMLIGHT)
    integration: str | None = None  # dominio de la integración (no es un complemento)


SERVICES: tuple[ServiceDef, ...] = (
    ServiceDef("mosquitto", "Mosquitto (MQTT)", lambda s: s == "core_mosquitto" or s.endswith("_mosquitto")),
    ServiceDef("zigbee2mqtt", "Zigbee2MQTT", lambda s: "zigbee2mqtt" in s, depends=("mosquitto",), mqtt_bridge=True, coordinator=True),
    ServiceDef("cloudflared", "Cloudflared (acceso remoto)", lambda s: s.endswith("cloudflared"), remote_probe=True),
)
# integraciones de nube que se cuelgan: además de que arranquen, sus equipos tienen que responder
INTEGRATIONS: tuple[ServiceDef, ...] = (
    ServiceDef("ttlock", "TTLock", integration="ttlock"),
    ServiceDef("tuya", "Tuya", integration="tuya"),
    ServiceDef("smartlife", "Smart Life", integration="smartlife"),
    ServiceDef("sonoff", "eWeLink (Sonoff)", integration="sonoff"),
)
REMOTE_TIMEOUT = 12  # segundos
BAD_ENTRY_STATES = (ConfigEntryState.SETUP_ERROR, ConfigEntryState.SETUP_RETRY, ConfigEntryState.NOT_LOADED)
BUSY_ENTRY_STATES = {s for s in ConfigEntryState if s.name.endswith("_IN_PROGRESS")}  # UNLOAD_… existe desde HA 2025


@dataclass
class Tracked:
    """Un complemento o integración vigilado (puede haber más de un Zigbee2MQTT)."""

    sdef: ServiceDef
    slug: str  # slug del complemento, o dominio de la integración
    name: str
    key: str  # zigbee2mqtt, zigbee2mqtt_2, ttlock…
    addon_state: str = "unknown"  # en integraciones: el estado de la entrada (loaded, setup_error…)
    version: str | None = None
    status: str = UNKNOWN
    detail: str = ""
    entry_id: str | None = None
    unavail_since: datetime | None = None  # integraciones: desde cuándo todos sus equipos no responden
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)


def _needs_login(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Pide volver a iniciar sesión (o falló la migración): recargarla no sirve, la tiene que ver una persona."""
    if entry.state == ConfigEntryState.MIGRATION_ERROR:
        return True
    try:
        return any(entry.async_get_active_flows(hass, {SOURCE_REAUTH}))
    except Exception:  # noqa: BLE001
        return False


def _ts(d: datetime | None) -> str | None:
    return d.isoformat() if d else None


def _dt(s: Any) -> datetime | None:
    return dt_util.parse_datetime(s) if isinstance(s, str) else None


class Watchdog:
    def __init__(self, hass: HomeAssistant, client_factory: Callable[[], Any] | None = None) -> None:
        self.hass = hass
        self._client_factory = client_factory
        self._store: Store[dict[str, Any]] = Store(hass, 1, STORE_KEY)
        self.data: dict[str, Any] = {"services": {}, "integrations": {}, "maintenance_until": None}
        self.tracked: dict[str, Tracked] = {}
        self.available = False  # hay Supervisor
        self.bridges: dict[str, dict[str, Any]] = {}  # base_topic → {state, since}
        self.remote: dict[str, Any] | None = None  # {kind: ok | tunnel | internet, since, detail}
        self.probe_url: str | None = None  # para pruebas: si no, la dirección remota cargada en MatterAI
        self.started_at = dt_util.utcnow()
        self.last_check: datetime | None = None
        self._unsubs: list[Callable[[], None]] = []
        self._check_lock = asyncio.Lock()
        self._pending_check = None

    # ------------------------------------------------------------ ciclo de vida
    async def async_start(self) -> None:
        self.data = (await self._store.async_load()) or self.data
        self.data.setdefault("services", {})
        self.data.setdefault("integrations", {})
        self._unsubs.append(async_track_time_interval(self.hass, self._tick, CHECK_EVERY))
        await self._async_subscribe_mqtt()
        self.hass.async_create_background_task(self.async_check(), "matterai_watchdog_first")

    @callback
    def stop(self) -> None:
        for unsub in self._unsubs:
            unsub()
        self._unsubs.clear()
        if self._pending_check:
            self._pending_check()
            self._pending_check = None

    def _client(self):
        if self._client_factory:
            return self._client_factory()
        from homeassistant.helpers.hassio import is_hassio  # noqa: PLC0415

        if not is_hassio(self.hass) or "hassio" not in self.hass.config.components:
            return None
        from homeassistant.components.hassio import get_supervisor_client  # noqa: PLC0415

        return get_supervisor_client(self.hass)

    def _save(self) -> None:
        self._store.async_delay_save(lambda: self.data, 2)

    def _svc(self, key: str) -> dict[str, Any]:
        return self.data["services"].setdefault(key, {"down_since": None, "attempts": 0, "next_try": None, "last_action": None,
                                                      "last_action_at": None, "restarts": 0, "version": None, "prev_version": None,
                                                      "version_changed_at": None, "last_down_secs": None})

    # ------------------------------------------------------------ MQTT: estado de Zigbee2MQTT
    async def _async_subscribe_mqtt(self) -> None:
        if "mqtt" not in self.hass.config.components:
            return
        try:
            from homeassistant.components import mqtt  # noqa: PLC0415

            self._unsubs.append(await mqtt.async_subscribe(self.hass, "+/bridge/state", self._on_bridge_msg))
        except Exception:  # noqa: BLE001 - sin MQTT se vigila sólo el estado del complemento
            _LOGGER.debug("No se pudo escuchar el estado de Zigbee2MQTT por MQTT", exc_info=True)

    @callback
    def _on_bridge_msg(self, msg) -> None:
        base = str(msg.topic).rsplit("/bridge/state", 1)[0]
        payload = msg.payload if isinstance(msg.payload, str) else msg.payload.decode(errors="ignore")
        self.on_bridge(base, payload)

    @callback
    def on_bridge(self, base: str, payload: str) -> None:
        state = payload.strip().lower()
        if state.startswith("{"):
            try:
                state = str(json.loads(state).get("state", "")).lower()
            except ValueError:
                return
        if state not in ("online", "offline"):
            return
        prev = self.bridges.get(base)
        if prev and prev["state"] == state:
            return
        self.bridges[base] = {"state": state, "since": dt_util.utcnow()}
        _LOGGER.info("Zigbee2MQTT «%s»: %s", base, state)
        if state == "offline":
            # que no espere al próximo minuto: revisar cuando se cumpla el margen de «offline sostenido»
            if self._pending_check:
                self._pending_check()
            self._pending_check = async_call_later(self.hass, OFFLINE_FOR.total_seconds() + 5, self._delayed_check)
        else:
            self.hass.async_create_task(self.async_check())

    @callback
    def _delayed_check(self, _now) -> None:
        self._pending_check = None
        self.hass.async_create_task(self.async_check())

    def _z2m_count(self) -> int:
        return sum(1 for t in self.tracked.values() if t.sdef.mqtt_bridge)

    def live_bridges(self, z2m_count: int | None = None) -> dict[str, dict[str, Any]]:
        """Los base_topic de los Zigbee2MQTT que existen.

        Un Zigbee2MQTT desinstalado deja en el broker su último «offline» guardado (retenido) y se sigue
        recibiendo para siempre. Si hay más base_topics que complementos y los «online» alcanzan para
        todos, los «offline» que sobran son de uno que ya no está: no cuentan (ni para avisar, ni para
        reiniciar el que sí anda)."""
        n = self._z2m_count() if z2m_count is None else z2m_count
        if n and len(self.bridges) > n:
            online = {k: b for k, b in self.bridges.items() if b["state"] == "online"}
            if len(online) >= n:
                return online
        return dict(self.bridges)

    def _bridge_for(self, t: Tracked, z2m_count: int) -> dict[str, Any] | None:
        """El estado MQTT de este Zigbee2MQTT. Con un solo Z2M y un solo base_topic, son el mismo."""
        bridges = self.live_bridges(z2m_count)
        if not bridges:
            return None
        if z2m_count == 1 and len(bridges) == 1:
            return next(iter(bridges.values()))
        # varios: se busca un base_topic que se parezca al nombre del complemento
        for base, b in bridges.items():
            if base.split("-")[-1] in t.slug or base in t.slug:
                return b
        offline = [b for b in bridges.values() if b["state"] == "offline"]
        return offline[0] if offline else next(iter(bridges.values()))

    # ------------------------------------------------------------ coordinador (SLZB-06 / SMLIGHT)
    def coordinator_ok(self) -> tuple[bool, str]:
        entries = self.hass.config_entries.async_entries("smlight")
        if not entries:
            return True, ""  # sin coordinador de red conocido: no se puede chequear
        reg = er.async_get(self.hass)
        for entry in entries:
            if entry.disabled_by:
                continue
            if entry.state != ConfigEntryState.LOADED:
                return False, f"el coordinador «{entry.title}» no responde (integración SMLIGHT sin conexión)"
            states = [self.hass.states.get(e.entity_id) for e in er.async_entries_for_config_entry(reg, entry.entry_id) if not e.disabled_by]
            if states and all(s is None or s.state in ("unavailable", "unknown") for s in states):
                return False, f"el coordinador «{entry.title}» no responde en la red"
        return True, ""

    # ------------------------------------------------------------ mantenimiento
    @property
    def maintenance(self) -> bool:
        until = _dt(self.data.get("maintenance_until"))
        return bool(until and until > dt_util.utcnow())

    @property
    def maintenance_until(self) -> datetime | None:
        return _dt(self.data.get("maintenance_until")) if self.maintenance else None

    async def async_set_maintenance(self, minutes: int | None) -> None:
        if minutes and minutes > 0:
            until = dt_util.utcnow() + timedelta(minutes=minutes)
            self.data["maintenance_until"] = until.isoformat()
            _LOGGER.info("Mantenimiento del sistema activado hasta %s", until)
            async_call_later(self.hass, minutes * 60 + 2, self._maintenance_timeout)
        else:
            self.data["maintenance_until"] = None
            _LOGGER.info("Mantenimiento del sistema desactivado")
        self._save()
        await self.async_check()

    @callback
    def _maintenance_timeout(self, _now) -> None:
        until = _dt(self.data.get("maintenance_until"))
        if until and until <= dt_util.utcnow():
            self.data["maintenance_until"] = None
            self.data["maintenance_ended"] = dt_util.utcnow().isoformat()
            self._save()
            _LOGGER.info("Mantenimiento del sistema: terminó el tiempo, vuelve a vigilar")
            self.hass.async_create_task(self.async_check())

    # ------------------------------------------------------------ chequeo
    async def _tick(self, _now=None) -> None:
        await self.async_check()

    async def async_check(self, force: bool = False) -> None:
        if self._check_lock.locked():
            return
        async with self._check_lock:
            try:
                await self._async_check(force)
            except Exception:  # noqa: BLE001 - el watchdog nunca se cae: se reintenta en el próximo minuto
                _LOGGER.exception("Mantenimiento del sistema: error en el chequeo")
            self.last_check = dt_util.utcnow()
            async_dispatcher_send(self.hass, SIGNAL_WATCHDOG)

    async def _async_check(self, force: bool) -> None:
        client = self._client()
        self.available = client is not None
        # sin Supervisor (HA Core/Container) no hay complementos, pero las integraciones se cuidan igual
        addons = await client.addons.list() if client is not None else []
        self._sync_tracked(addons)
        now = dt_util.utcnow()
        self._async_other_integrations(now, force)
        z2m_count = self._z2m_count()
        if any(t.sdef.remote_probe for t in self.tracked.values()):
            await self._async_probe_remote(now)
        # dependencias primero
        order = sorted(self.tracked.values(), key=lambda t: len(t.sdef.depends))
        for t in order:
            await self._async_service(client, t, now, z2m_count, force)
        self._save()

    def _sync_tracked(self, addons: list[Any]) -> None:
        seen: dict[str, Tracked] = {}
        counts: dict[str, int] = {}
        for addon in sorted(addons, key=lambda a: a.slug):
            for sdef in SERVICES:
                if sdef.match(addon.slug):
                    counts[sdef.key] = counts.get(sdef.key, 0) + 1
                    key = sdef.key if counts[sdef.key] == 1 else f"{sdef.key}_{counts[sdef.key]}"
                    t = self.tracked.get(key)
                    if t is None or t.slug != addon.slug:
                        t = Tracked(sdef, addon.slug, addon.name, key)
                    t.name = addon.name
                    t.addon_state = str(addon.state)
                    t.version = addon.version
                    seen[key] = t
                    break
        for sdef in INTEGRATIONS:
            entries = [e for e in self.hass.config_entries.async_entries(sdef.integration)
                       if not e.disabled_by and e.source != SOURCE_IGNORE]
            for n, entry in enumerate(sorted(entries, key=lambda e: e.entry_id), 1):
                key = sdef.key if n == 1 else f"{sdef.key}_{n}"
                t = self.tracked.get(key)
                if t is None or t.entry_id != entry.entry_id:
                    t = Tracked(sdef, sdef.integration, sdef.name, key, entry_id=entry.entry_id)
                t.name = sdef.name if len(entries) == 1 else f"{sdef.name} ({entry.title})"
                t.addon_state = entry.state.value
                seen[key] = t
        self.tracked = seen

    # ------------------------------------------------------------ integraciones que no arrancaron
    def managed_entries(self) -> set[str]:
        return {t.entry_id for t in self.tracked.values() if t.entry_id}

    @callback
    def _async_other_integrations(self, now: datetime, force: bool) -> None:
        """Cualquier integración que quedó sin arrancar se recarga (las de nube vigiladas van por su servicio)."""
        recs: dict[str, dict[str, Any]] = self.data.setdefault("integrations", {})
        managed = self.managed_entries()
        bad: dict[str, ConfigEntry] = {}
        for entry in self.hass.config_entries.async_entries():
            if (entry.domain == DOMAIN or entry.entry_id in managed or entry.disabled_by or entry.source == SOURCE_IGNORE
                    or entry.state not in BAD_ENTRY_STATES or _needs_login(self.hass, entry)):
                continue
            bad[entry.entry_id] = entry
        for entry_id in [k for k in recs if k not in bad]:
            rec = recs.pop(entry_id)
            if rec.get("attempts"):
                _LOGGER.info("La integración «%s» volvió a funcionar", rec.get("title"))
        if self.maintenance or (now - self.started_at < START_GRACE and not force):
            return
        for entry_id, entry in bad.items():
            rec = recs.setdefault(entry_id, {"title": entry.title or entry.domain, "domain": entry.domain, "since": now.isoformat(),
                                             "attempts": 0, "next_try": None, "last_action_at": None})
            rec["state"] = entry.state.value
            # «reintentando»: HA lo reintenta solo; se interviene si sigue así 3 minutos
            if entry.state == ConfigEntryState.SETUP_RETRY and now - (_dt(rec["since"]) or now) < OFFLINE_FOR:
                continue
            nxt = _dt(rec.get("next_try"))
            if nxt and now < nxt and not force:
                continue
            attempts = rec["attempts"] + 1
            wait = BACKOFF[min(attempts - 1, len(BACKOFF) - 1)] if attempts < MANUAL_AFTER else 3600
            rec.update(attempts=attempts, last_action_at=now.isoformat(), next_try=(now + timedelta(seconds=wait)).isoformat())
            _LOGGER.info("La integración «%s» no arrancó (%s): se recarga (intento %s)", rec["title"], entry.state.value, attempts)
            self.hass.async_create_background_task(self._async_reload(entry_id, rec["title"]), f"matterai_watchdog_reload_{entry_id}")

    async def _async_reload(self, entry_id: str, title: str, lock: asyncio.Lock | None = None) -> None:
        """Recarga en segundo plano: una integración lenta no traba el resto del chequeo."""
        async with lock or asyncio.Lock():
            entry = self.hass.config_entries.async_get_entry(entry_id)
            if entry is None:
                return
            try:
                if entry.state == ConfigEntryState.NOT_LOADED:
                    ok = await self.hass.config_entries.async_setup(entry_id)
                else:
                    ok = await self.hass.config_entries.async_reload(entry_id)
            except Exception as err:  # noqa: BLE001 - se reintenta con backoff
                _LOGGER.warning("No se pudo recargar «%s»: %s", title, err)
                return
            _LOGGER.info("«%s» recargada: %s", title, "arrancó bien" if ok else f"sigue sin arrancar ({entry.state.value})")
        async_dispatcher_send(self.hass, SIGNAL_WATCHDOG)

    # ------------------------------------------------------------ acceso remoto (Cloudflared)
    def external_url(self) -> str | None:
        if self.probe_url:
            return self.probe_url
        entry = self.hass.data.get(DOMAIN, {}).get("entry")
        if entry is None:
            return None
        url = str({**entry.data, **entry.options}.get(CONF_URL) or "").strip().rstrip("/")
        return url if url.startswith("http") else None

    async def _async_probe_remote(self, now: datetime) -> None:
        """La casa entra a su propia dirección por internet: así se sabe si el túnel está conectado."""
        url = self.external_url()
        if not url:
            self.remote = None
            return
        import aiohttp  # noqa: PLC0415

        from homeassistant.helpers.aiohttp_client import async_get_clientsession  # noqa: PLC0415

        kind, detail = "ok", ""
        try:
            async with asyncio.timeout(REMOTE_TIMEOUT):
                resp = await async_get_clientsession(self.hass).get(f"{url}/manifest.json", allow_redirects=False)
                if resp.status >= 500:
                    kind, detail = "tunnel", f"Cloudflare responde {resp.status} (túnel desconectado)"
        except (aiohttp.ClientConnectorError, aiohttp.ClientConnectionError, OSError) as err:
            kind, detail = "internet", f"sin conexión a internet o DNS ({type(err).__name__})"
        except TimeoutError:
            kind, detail = "internet", "no responde (internet lenta o caída)"
        except Exception as err:  # noqa: BLE001
            kind, detail = "internet", str(err)[:120]
        if self.remote is None or self.remote["kind"] != kind:
            self.remote = {"kind": kind, "since": now, "detail": detail}
            _LOGGER.info("Acceso remoto (%s): %s %s", url, kind, detail)

    def _healthy(self, t: Tracked, now: datetime, z2m_count: int) -> tuple[bool | None, str, str]:
        """(sano, motivo, acción) — sano None = todavía no se sabe."""
        if t.entry_id:
            return self._integration_healthy(t, now)
        if t.addon_state in ("stopped", "error"):
            return False, "falló y no está andando" if t.addon_state == "error" else "está detenido", "start"
        if t.addon_state not in ("started", "startup"):
            return None, f"estado desconocido ({t.addon_state})", ""
        if t.addon_state == "startup":
            return None, "arrancando", ""
        if t.sdef.remote_probe and self.remote is not None:
            r = self.remote
            if r["kind"] == "internet":
                return None, "la casa no tiene internet: no se puede comprobar el acceso remoto (no lo reinicio)", ""
            if r["kind"] == "tunnel":
                if now - r["since"] >= OFFLINE_FOR:
                    return False, f"anda pero la dirección remota no responde: {r['detail']}", "restart"
                return None, "acceso remoto sin respuesta hace poco", ""
        if t.sdef.mqtt_bridge and ("mqtt" in self.hass.config.components or self.bridges):
            b = self._bridge_for(t, z2m_count)
            if b is None:
                started = self._svc(t.key).get("last_action_at")
                ref = max(self.started_at, _dt(started) or self.started_at)
                if now - ref > NO_BRIDGE_FOR:
                    return False, "anda pero no se conecta a MQTT (no publica su estado)", "restart"
                return None, "esperando su estado por MQTT", ""
            if b["state"] == "offline":
                if now - b["since"] >= OFFLINE_FOR:
                    return False, "anda pero está desconectado de la red Zigbee (offline)", "restart"
                return None, "offline hace poco", ""
        return True, "", ""

    def _integration_healthy(self, t: Tracked, now: datetime) -> tuple[bool | None, str, str]:
        entry = self.hass.config_entries.async_get_entry(t.entry_id)
        if entry is None:
            return None, "estado desconocido (la integración ya no está)", ""
        if _needs_login(self.hass, entry):
            return False, "pide volver a iniciar sesión (Ajustes → Integraciones): recargarla no alcanza", "manual"
        st = entry.state
        if st in BUSY_ENTRY_STATES:
            return None, "arrancando", ""
        if st == ConfigEntryState.SETUP_RETRY:
            # HA la reintenta sola; si sigue así 3 minutos, se recarga
            t.unavail_since = t.unavail_since or now
            if now - t.unavail_since >= OFFLINE_FOR:
                return False, "no puede conectarse desde que arrancó (sigue reintentando)", "reload"
            return None, "conectándose", ""
        if st in (ConfigEntryState.SETUP_ERROR, ConfigEntryState.NOT_LOADED, ConfigEntryState.FAILED_UNLOAD):
            return False, "no arrancó" + (f": {entry.reason}" if getattr(entry, "reason", None) else ""), "reload"
        # cargada: ¿responden sus equipos?
        reg = er.async_get(self.hass)
        states = [self.hass.states.get(e.entity_id) for e in er.async_entries_for_config_entry(reg, entry.entry_id) if not e.disabled_by]
        if states and all(s is None or s.state in ("unavailable", "unknown") for s in states):
            t.unavail_since = t.unavail_since or now
            mins = int((now - t.unavail_since).total_seconds() // 60)
            if now - t.unavail_since >= OFFLINE_FOR:
                return False, f"ninguno de sus equipos responde (hace {mins} min)", "reload"
            return None, "sus equipos no responden hace poco", ""
        t.unavail_since = None
        return True, "", ""

    async def _async_service(self, client, t: Tracked, now: datetime, z2m_count: int, force: bool) -> None:
        s = self._svc(t.key)
        # versión: para avisar «falló después de actualizar»
        if t.version and s.get("version") and t.version != s["version"]:
            s["prev_version"], s["version_changed_at"] = s["version"], now.isoformat()
        if t.version:
            s["version"] = t.version
        healthy, why, action = self._healthy(t, now, z2m_count)
        if healthy:
            if s.get("down_since"):
                down = now - _dt(s["down_since"])
                s["last_down_secs"] = int(down.total_seconds())
                s["recovered_at"] = now.isoformat()
                _LOGGER.info("%s volvió a funcionar después de %s", t.name, down)
            s.update(down_since=None, attempts=0, next_try=None)
            t.status, t.detail = OK, ""
            self._clear_repair(t)
            return
        if healthy is None:
            if not s.get("down_since"):
                t.status, t.detail = (UNKNOWN if why.startswith("estado") else OK), why
                return
        if not s.get("down_since"):
            s["down_since"] = now.isoformat()
        t.detail = why
        if self.maintenance:
            t.status = MAINT
            return
        if now - self.started_at < START_GRACE and not force:
            t.status = RECOVERING
            t.detail = f"{why} (esperando que termine de iniciar Home Assistant)"
            return
        # dependencias: primero ellas
        for dep in t.sdef.depends:
            dt_ = self.tracked.get(dep)
            if dt_ is not None and dt_.status != OK:
                t.status, t.detail = WAIT_DEP, f"{why}; primero hay que recuperar {dt_.name}"
                return
        if t.sdef.coordinator:
            ok, hw = self.coordinator_ok()
            if not ok:
                t.status, t.detail = WAIT_HW, f"{why}; {hw}: no lo reinicio hasta que el coordinador vuelva"
                return
        if not action:
            t.status = RECOVERING
            return
        if action == "manual":
            t.status = MANUAL
            return
        nxt = _dt(s.get("next_try"))
        if nxt and now < nxt and not force:
            t.status = MANUAL if s.get("attempts", 0) >= MANUAL_AFTER else RECOVERING
            return
        if t.lock.locked():
            return
        async with t.lock:
            attempts = s.get("attempts", 0) + 1
            try:
                if action == "reload":
                    # en segundo plano y con el mismo candado: no se superpone con el próximo chequeo
                    self.hass.async_create_background_task(self._async_reload(t.entry_id, t.name, t.lock), f"matterai_watchdog_reload_{t.key}")
                elif action == "start":
                    await client.addons.start_addon(t.slug)
                else:
                    await client.addons.restart_addon(t.slug)
                result = "ok"
            except Exception as err:  # noqa: BLE001 - se informa y se reintenta con backoff
                result = f"error: {err}"
                _LOGGER.warning("No se pudo %s %s: %s", "arrancar" if action == "start" else "reiniciar", t.name, err)
            if t.entry_id:
                t.unavail_since = now  # se le da tiempo a que sus equipos vuelvan antes de volver a contar
            wait = BACKOFF[min(attempts - 1, len(BACKOFF) - 1)] if attempts < MANUAL_AFTER else 3600
            s.update(attempts=attempts, last_action=f"{action} ({result})", last_action_at=now.isoformat(),
                     next_try=(now + timedelta(seconds=wait)).isoformat(), restarts=s.get("restarts", 0) + 1)
            # después de actuar, se le da tiempo antes de volver a contar la falla
            if t.sdef.remote_probe and self.remote and self.remote["kind"] == "tunnel":
                self.remote["since"] = now
            if t.sdef.mqtt_bridge:
                for b in self.bridges.values():
                    if b["state"] == "offline":
                        b["since"] = now
            t.status = MANUAL if attempts >= MANUAL_AFTER else RECOVERING
            _LOGGER.info("%s: %s (intento %s, motivo: %s). Próximo intento en %s s", t.name,
                         {"start": "arrancado", "reload": "recargando"}.get(action, "reiniciado"), attempts, why, wait)

    # ------------------------------------------------------------ avisos
    def update_note(self, t: Tracked) -> str:
        s = self._svc(t.key)
        changed = _dt(s.get("version_changed_at"))
        if changed and dt_util.utcnow() - changed < UPDATE_RECENT and s.get("prev_version"):
            return f" Posible falla por la actualización de {s['prev_version']} a {s.get('version')}."
        return ""

    def alerts(self) -> list[dict[str, str]]:
        """Para el panel central (con la misma forma que el resto de health.py)."""
        out: list[dict[str, str]] = []
        now = dt_util.utcnow()
        if self.maintenance:
            return out
        for t in self.tracked.values():
            s = self._svc(t.key)
            since = _dt(s.get("down_since"))
            if t.status in (OK, UNKNOWN) or not since or now - since < ALERT_AFTER:
                continue
            mins = int((now - since).total_seconds() // 60)
            tries = s.get("attempts", 0)
            text = f"{t.name}: {t.detail} (hace {mins} min"
            text += f", {tries} intento{'s' if tries != 1 else ''} de recuperarlo)" if tries else ")"
            if t.status == MANUAL:
                text += ". Necesita atención manual."
            text += self.update_note(t)
            level = "critical" if t.status == MANUAL else "warning"
            out.append({"level": level, "key": f"watchdog:{t.key}", "text": text[:300]})
            if now - since >= REPAIR_AFTER:
                self._repair(t, text)
        return out

    def managed_slugs(self) -> set[str]:
        return {t.slug for t in self.tracked.values()}

    def _repair(self, t: Tracked, text: str) -> None:
        ir.async_create_issue(self.hass, DOMAIN, f"watchdog_{t.key}", is_fixable=False, severity=ir.IssueSeverity.ERROR,
                              translation_key="service_down", translation_placeholders={"service": t.name, "detail": text})

    def _clear_repair(self, t: Tracked) -> None:
        ir.async_delete_issue(self.hass, DOMAIN, f"watchdog_{t.key}")

    # ------------------------------------------------------------ estado para el panel
    def as_dict(self) -> dict[str, Any]:
        out = []
        for t in sorted(self.tracked.values(), key=lambda x: len(x.sdef.depends)):
            s = self._svc(t.key)
            out.append({
                "key": t.key, "name": t.name, "slug": t.slug, "addon_state": t.addon_state, "version": t.version,
                "kind": "integration" if t.entry_id else "addon",
                "status": t.status, "status_text": STATE_TEXT.get(t.status, t.status), "detail": t.detail,
                "down_since": s.get("down_since"), "attempts": s.get("attempts", 0), "restarts": s.get("restarts", 0),
                "last_action": s.get("last_action"), "last_action_at": s.get("last_action_at"),
                "last_down_secs": s.get("last_down_secs"), "recovered_at": s.get("recovered_at"),
                "update_note": self.update_note(t).strip(),
            })
        return {
            "available": self.available,
            "maintenance_until": _ts(self.maintenance_until),
            "last_check": _ts(self.last_check),
            "bridges": {k: {"state": v["state"], "since": _ts(v["since"])} for k, v in self.live_bridges().items()},
            "coordinator": dict(zip(("ok", "detail"), self.coordinator_ok())),
            "remote": {"kind": self.remote["kind"], "since": _ts(self.remote["since"]), "detail": self.remote["detail"], "url": self.external_url()} if self.remote else None,
            "services": out,
            "integrations": [{"entry_id": k, **v} for k, v in self.data.get("integrations", {}).items()],
        }
