"""Dispositivos de la app: qué dispositivos y entidades de Home Assistant usa MatterAI.

El instalador elige los dispositivos (y entidades sueltas: escenas, rutinas, ayudantes, personas…) que son del cliente.
Con eso se filtran los avisos de fallas, la voz, lo que recibe la app y las listas del editor: nada de los cientos de
entidades técnicas o de prueba que suele tener una casa.

- Se elige por dispositivo: un dispositivo trae sus entidades útiles; las técnicas (diagnóstico, configuración, ocultas o
  desactivadas) quedan afuera solas.
- Mientras el instalador no guarde una selección, todo sigue habilitado como siempre (las casas que ya andaban no cambian).
  La pantalla le propone una para revisar: lo que ya usa en ambientes y dashboards, los dispositivos con ambiente, las
  escenas, rutinas, clima y personas.
- Los dispositivos que aparecen después quedan «sin revisar» (avisa Salud y la Puesta en marcha) y no entran solos.
- Las entidades de la propia integración MatterAI (automatizaciones, mantenimiento) siempre están.
"""

from __future__ import annotations

import re
from typing import Any

from homeassistant.core import Event, HomeAssistant, callback
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.storage import Store

from .const import DOMAIN, STORAGE_VERSION

STORAGE_SELECTION_KEY = f"{DOMAIN}.app_entities"
ENTITY_ID = re.compile(r"^[a-z_]+\.[a-z0-9_]+$")
# siempre: lo que la app usa sin que sea un dispositivo de la casa
ALWAYS_DOMAINS = {"sun", "zone"}
# sueltas que se proponen de entrada (sin dispositivo): lo que el cliente usa
PROPOSE_LOOSE = {"scene", "script", "automation", "person", "weather", "calendar", "alarm_control_panel", "camera"}
# lo que nunca le sirve a la app (no se lista)
HIDDEN_DOMAINS = {"update", "event", "conversation", "tts", "stt", "wake_word", "assist_satellite", "zone", "sun", "persistent_notification", "ai_task"}
# nombres de los grupos de sueltas
LOOSE_GROUPS = [
    ("scene", "Escenas"), ("automation", "Rutinas (automatizaciones)"), ("script", "Scripts"), ("person", "Personas"),
    ("weather", "Clima"), ("calendar", "Calendarios"), ("camera", "Cámaras"), ("alarm_control_panel", "Alarmas"),
    ("input_boolean", "Ayudantes"), ("input_select", "Ayudantes"), ("input_number", "Ayudantes"), ("input_button", "Ayudantes"),
    ("input_datetime", "Ayudantes"), ("input_text", "Ayudantes"), ("timer", "Ayudantes"), ("counter", "Ayudantes"), ("group", "Grupos"),
]
GROUP_OF = dict(LOOSE_GROUPS)


def _technical(entry: er.RegistryEntry | None) -> bool:
    return bool(entry is not None and (entry.entity_category or entry.hidden or entry.disabled))


class Selection:
    """La selección guardada: {enabled, devices, entities, known}."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORAGE_SELECTION_KEY)
        self.enabled = False
        self.devices: set[str] = set()
        self.entities: set[str] = set()
        self.known: set[str] = set()
        self._cache: set[str] | None = None
        self._unsubs: list = []

    async def async_load(self) -> None:
        data = await self._store.async_load() or {}
        self.enabled = bool(data.get("enabled"))
        self.devices = set(data.get("devices") or [])
        self.entities = set(data.get("entities") or [])
        self.known = set(data.get("known") or [])
        self._cache = None

    def start(self) -> None:
        """Si se agregan o cambian dispositivos o entidades, se recalcula lo permitido."""
        @callback
        def _changed(_ev: Event) -> None:
            self._cache = None
        self._unsubs = [self.hass.bus.async_listen(er.EVENT_ENTITY_REGISTRY_UPDATED, _changed),
                        self.hass.bus.async_listen(dr.EVENT_DEVICE_REGISTRY_UPDATED, _changed)]

    def stop(self) -> None:
        for u in self._unsubs:
            u()
        self._unsubs = []

    async def async_save(self, devices: list[str], entities: list[str], enabled: bool = True) -> None:
        self.enabled = enabled
        self.devices = set(devices)
        self.entities = set(entities)
        # lo que había al guardar ya está revisado; lo que aparezca después queda «sin revisar»
        self.known = {d["id"] for d in candidate_devices(self.hass)} | {s["id"] for s in candidate_loose(self.hass)}
        self._cache = None
        await self._store.async_save({"enabled": self.enabled, "devices": sorted(self.devices), "entities": sorted(self.entities), "known": sorted(self.known)})

    # ---------------------------------------------------------------- lo permitido
    @callback
    def allowed(self) -> set[str] | None:
        """Las entidades que usa la app, o None si no hay selección (todo habilitado, como siempre)."""
        if not self.enabled:
            return None
        if self._cache is not None:
            return self._cache
        reg = er.async_get(self.hass)
        ids = set(self.entities)
        for entry in reg.entities.values():
            if entry.platform == DOMAIN:  # lo de la propia integración
                ids.add(entry.entity_id)
            elif entry.device_id in self.devices and not _technical(entry):
                ids.add(entry.entity_id)
        for st in self.hass.states.async_all(tuple(ALWAYS_DOMAINS)):
            ids.add(st.entity_id)
        self._cache = ids
        return ids

    @callback
    def is_allowed(self, entity_id: str) -> bool:
        ok = self.allowed()
        return ok is None or entity_id in ok

    @callback
    def unreviewed(self) -> list[dict[str, Any]]:
        """Dispositivos y sueltas que aparecieron después de la última revisión (y no se eligieron)."""
        if not self.enabled:
            return []
        out = [d for d in candidate_devices(self.hass) if d["id"] not in self.known and d["id"] not in self.devices]
        out += [s for s in candidate_loose(self.hass) if s["id"] not in self.known and s["id"] not in self.entities]
        return out


# ---------------------------------------------------------------- qué hay en la casa
@callback
def candidate_devices(hass: HomeAssistant) -> list[dict[str, Any]]:
    """Los dispositivos que tienen algo útil para la app (con sus entidades que no son técnicas)."""
    ent_reg, dev_reg, area_reg = er.async_get(hass), dr.async_get(hass), ar.async_get(hass)
    by_dev: dict[str, list[er.RegistryEntry]] = {}
    for entry in ent_reg.entities.values():
        if not entry.device_id or _technical(entry) or entry.platform == DOMAIN or entry.domain in HIDDEN_DOMAINS:
            continue
        by_dev.setdefault(entry.device_id, []).append(entry)
    out = []
    for did, ents in by_dev.items():
        dev = dev_reg.async_get(did)
        if dev is None or dev.disabled_by:
            continue
        aid = dev.area_id or next((e.area_id for e in ents if e.area_id), None)
        area = area_reg.async_get_area(aid) if aid else None
        integ = ""
        if ents:
            integ = ents[0].platform
        out.append({
            "id": did, "name": dev.name_by_user or dev.name or "Dispositivo", "area": area.name if area else "", "area_id": aid or "",
            "model": " ".join(x for x in (dev.manufacturer, dev.model) if x), "integration": integ,
            "service": dev.entry_type == dr.DeviceEntryType.SERVICE,
            "entities": sorted(e.entity_id for e in ents),
        })
    out.sort(key=lambda d: (d["area"] == "", d["area"].lower(), d["name"].lower()))
    return out


@callback
def candidate_loose(hass: HomeAssistant) -> list[dict[str, Any]]:
    """Entidades sin dispositivo que le pueden servir a la app (escenas, rutinas, ayudantes, personas, clima…)."""
    ent_reg = er.async_get(hass)
    out = []
    for st in hass.states.async_all():
        if st.domain in HIDDEN_DOMAINS:
            continue
        entry = ent_reg.async_get(st.entity_id)
        if _technical(entry) or (entry is not None and (entry.device_id or entry.platform == DOMAIN)):
            continue
        out.append({"id": st.entity_id, "name": st.attributes.get("friendly_name") or st.entity_id, "domain": st.domain,
                    "group": GROUP_OF.get(st.domain, "Otros")})
    out.sort(key=lambda s: (s["group"], s["name"].lower()))
    return out


def referenced_ids(*configs: Any) -> set[str]:
    """Todas las entidades que aparecen en la configuración de la casa o en los dashboards."""
    found: set[str] = set()

    def walk(node: Any) -> None:
        if isinstance(node, dict):
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)
        elif isinstance(node, str) and ENTITY_ID.match(node):
            found.add(node)

    for c in configs:
        walk(c)
    return found


@callback
def proposal(hass: HomeAssistant, house_config: dict[str, Any], views: Any) -> tuple[set[str], set[str]]:
    """La selección que se propone de entrada: lo usado en ambientes y dashboards, lo que tiene ambiente, y las
    escenas, rutinas, clima, personas, calendarios, cámaras y alarmas."""
    used = referenced_ids(house_config, views)
    ent_reg = er.async_get(hass)
    devices: set[str] = set()
    for d in candidate_devices(hass):
        if d["area_id"] and not d["service"]:
            devices.add(d["id"])
        elif any(e in used for e in d["entities"]):
            devices.add(d["id"])
        elif d["service"] and any(e.split(".")[0] in ("weather", "calendar") for e in d["entities"]):
            devices.add(d["id"])
    entities = {s["id"] for s in candidate_loose(hass) if s["domain"] in PROPOSE_LOOSE or s["id"] in used}
    # una entidad usada cuyo dispositivo no se propuso (p. ej. sin ambiente): entra igual
    for eid in used:
        entry = ent_reg.async_get(eid)
        if entry is not None and entry.device_id and entry.device_id not in devices and hass.states.get(eid) is not None:
            entities.add(eid)
    return devices, entities


def get(hass: HomeAssistant) -> Selection | None:
    rt = hass.data.get(DOMAIN) or {}
    return rt.get("selection")


@callback
def is_allowed(hass: HomeAssistant, entity_id: str) -> bool:
    """Para el resto de la integración: ¿la app usa esta entidad? (sin selección guardada: sí, todas)."""
    sel = get(hass)
    return sel is None or sel.is_allowed(entity_id)
