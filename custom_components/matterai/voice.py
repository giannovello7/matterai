"""Control por voz de la app MatterAI ("prendé la música en el living").

El celular pasa la voz a texto; acá un modelo de Claude entiende el pedido con la lista de
ambientes y equipos de la casa y devuelve las acciones. La integración las valida (sólo equipos
y servicios permitidos de esta casa) y las ejecuta con los permisos del usuario que habló.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from homeassistant.core import Context, HomeAssistant
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er

_LOGGER = logging.getLogger(__name__)

MODEL = "claude-opus-5-5"
FALLBACK_BETA = "server-side-fallback-2026-07-01"

# Qué puede hacer la voz, por dominio (nada de alarmas, cerraduras ni portones: eso pide confirmación en la app)
ALLOWED: dict[str, set[str]] = {
    "light": {"turn_on", "turn_off", "toggle"},
    "switch": {"turn_on", "turn_off", "toggle"},
    "fan": {"turn_on", "turn_off", "toggle", "set_percentage"},
    "cover": {"open_cover", "close_cover", "stop_cover", "set_cover_position"},
    "climate": {"turn_on", "turn_off", "set_temperature", "set_hvac_mode"},
    "media_player": {"media_play", "media_pause", "media_stop", "media_next_track", "media_previous_track", "volume_set", "volume_mute", "shuffle_set", "repeat_set", "media_seek", "turn_on", "turn_off"},
    "scene": {"turn_on"},
    "script": {"turn_on"},
    "input_boolean": {"turn_on", "turn_off", "toggle"},
    "music_assistant": {"play_media", "transfer_queue"},
    "matterai": {"play_something"},  # "poné música" sin decir qué: una lista favorita al azar (lo resuelve VoiceBrain)
}
NEEDS_CONFIRM = {"lock", "alarm_control_panel"}  # nunca por voz
GARAGE = {"garage", "gate"}  # portones: tampoco por voz

SYSTEM_RULES = """Sos el asistente de voz de MatterAI, el sistema de casa inteligente de esta familia.
Te hablan en español rioplatense, a veces con errores de dictado. Entendé la intención y respondé SIEMPRE llamando a la herramienta `ejecutar` una sola vez, con todas las acciones necesarias y una respuesta corta para decir en voz alta (máximo una oración, en voseo, cálida y natural, sin repetir los nombres técnicos).

Reglas:
- Usá sólo equipos de la lista de abajo (entity_id exactos). Si nombran un ambiente, aplicá la acción a los equipos de ese tipo en ese ambiente.
- "Prendé/encendé la luz del X" = light.turn_on de las luces del ambiente X (los switch con nombre de luz también son luces).
- "Apagá todo" sin ambiente = apagar todas las luces de la casa. Con ambiente = luces, ventiladores, aire y tele de ese ambiente.
- Brillo en porcentaje (brightness_pct 1-100). Temperatura en °C. Persianas: posición 0 cerrada, 100 abierta.
- Música: cada ambiente trae su "parlante" (el reproductor de Music Assistant de ese lugar). Para poner algo usá music_assistant.play_media en ESE parlante con media_query (lo pedido), media_type (artist, track, album, playlist o radio) y media_artist si pidieron una canción o disco de alguien. "Poné música" sin decir qué = matterai.play_something en el parlante. Si no dicen dónde, usá el parlante que está sonando. "Pausá/pará la música" = media_player.media_pause.
- No existen acciones de alarmas, cerraduras ni portones por voz: si lo piden, no hagas acciones y respondé que eso se hace desde la app por seguridad.
- Si el pedido es una pregunta ("¿está prendida la luz del living?", "¿qué temperatura hace?"), respondé con los estados de abajo y sin acciones.
- Si no entendés o no hay ningún equipo que corresponda, no inventes: sin acciones y una respuesta corta pidiendo que lo repitan de otra forma.
"""

TOOL = {
    "name": "ejecutar",
    "description": "Ejecuta en la casa las acciones pedidas y dice la respuesta en voz alta. Llamala siempre una vez por pedido (acciones vacías si no hay nada para hacer).",
    "strict": True,
    "input_schema": {
        "type": "object",
        "additionalProperties": False,
        "required": ["acciones", "respuesta"],
        "properties": {
            "respuesta": {"type": "string", "description": "Lo que se le dice al usuario en voz alta, una oración."},
            "acciones": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["servicio", "entity_ids", "brightness_pct", "temperature", "hvac_mode", "position", "percentage", "volume_level", "media_query", "media_type", "media_artist", "enqueue"],
                    "properties": {
                        "servicio": {"type": "string", "description": "dominio.servicio, por ejemplo light.turn_on"},
                        "entity_ids": {"type": "array", "items": {"type": "string"}},
                        "brightness_pct": {"type": ["integer", "null"]},
                        "temperature": {"type": ["number", "null"]},
                        "hvac_mode": {"type": ["string", "null"], "description": "off, cool, heat, heat_cool, auto, dry o fan_only"},
                        "position": {"type": ["integer", "null"]},
                        "percentage": {"type": ["integer", "null"]},
                        "volume_level": {"type": ["number", "null"], "description": "0 a 1"},
                        "media_query": {"type": ["string", "null"]},
                        "media_type": {"type": ["string", "null"], "description": "artist, track, album, playlist o radio"},
                        "media_artist": {"type": ["string", "null"], "description": "artista, si pidieron una canción o disco de alguien"},
                        "enqueue": {"type": ["string", "null"], "description": "null = reproducir ya; add = al final de la cola; next = que suene después"},
                    },
                },
            },
        },
    },
}


def _entity_names(config: dict[str, Any]) -> dict[str, str]:
    names: dict[str, str] = {}

    def walk(node: Any) -> None:
        if isinstance(node, dict):
            if isinstance(node.get("entity"), str) and isinstance(node.get("name"), str):
                names[node["entity"]] = node["name"]
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)

    walk(config)
    return names


def house_catalog(hass: HomeAssistant, config: dict[str, Any]) -> list[dict[str, Any]]:
    """Ambientes y equipos controlables: los del dashboard (como los ve el cliente) o, si no hay, las Áreas de HA."""
    names = _entity_names(config)
    rooms: list[dict[str, Any]] = []
    seen: set[str] = set()

    def ok(eid: str) -> bool:
        st = hass.states.get(eid)
        if st is None or st.domain not in ALLOWED or eid in seen:
            return False
        if st.domain == "cover" and st.attributes.get("device_class") in GARAGE:
            return False
        return True

    def item(eid: str) -> dict[str, Any]:
        st = hass.states.get(eid)
        seen.add(eid)
        return {"id": eid, "nombre": names.get(eid) or st.attributes.get("friendly_name") or eid}

    for room in config.get("rooms") or []:
        if not isinstance(room, dict) or not room.get("name"):
            continue
        ids = [e.get("entity") if isinstance(e, dict) else e for e in room.get("entities") or []]
        eq = [item(e) for e in ids if isinstance(e, str) and ok(e)]
        if eq:
            rooms.append({"ambiente": room["name"], "equipos": eq})
    if not rooms:  # casa en modo automático: por Áreas
        ent_reg, dev_reg, area_reg = er.async_get(hass), dr.async_get(hass), ar.async_get(hass)
        by_area: dict[str, list[dict[str, Any]]] = {}
        for st in hass.states.async_all():
            entry = ent_reg.async_get(st.entity_id)
            if entry is None or entry.hidden or entry.disabled or entry.entity_category or not ok(st.entity_id):
                continue
            aid = entry.area_id or (dev_reg.async_get(entry.device_id).area_id if entry.device_id and dev_reg.async_get(entry.device_id) else None)
            area = area_reg.async_get_area(aid) if aid else None
            if area:
                by_area.setdefault(area.name, []).append(item(st.entity_id))
        rooms = [{"ambiente": k, "equipos": v} for k, v in sorted(by_area.items())]
    # el parlante de cada ambiente (de Music Assistant), aunque el instalador no lo haya puesto en el ambiente
    from .speakers import Speakers  # noqa: PLC0415

    spk = Speakers(hass)
    cfg_rooms = {r["name"]: r for r in config.get("rooms") or [] if isinstance(r, dict) and r.get("name")}
    for r in rooms:
        rc = cfg_rooms.get(r["ambiente"], {})
        sid = spk.for_room(r["ambiente"], [e["id"] for e in r["equipos"]], rc.get("speaker"))
        if not sid:
            continue
        r["parlante"] = sid
        if sid not in {e["id"] for e in r["equipos"]}:
            seen.add(sid)
            r["equipos"].append({"id": sid, "nombre": names.get(sid) or f"Parlante {r['ambiente']}"})
    every = spk.everywhere(config.get("speaker_all"))
    if every:
        seen.add(every)
        rooms.append({"ambiente": "Toda la casa", "equipos": [{"id": every, "nombre": "Todos los parlantes"}], "parlante": every, "todo": True})
    # escenas y rutinas sueltas (Modos)
    extra = [item(s.entity_id) for s in hass.states.async_all(("scene", "script")) if ok(s.entity_id)]
    if extra:
        rooms.append({"ambiente": "Modos (escenas y rutinas)", "equipos": extra})
    return rooms


def _states_line(hass: HomeAssistant, rooms: list[dict[str, Any]]) -> str:
    """Estado actual, aparte del catálogo: así el catálogo no cambia y queda en caché."""
    out = []
    for r in rooms:
        for e in r["equipos"]:
            st = hass.states.get(e["id"])
            if st is None:
                continue
            extra = ""
            a = st.attributes
            if st.domain == "climate" and a.get("current_temperature") is not None:
                extra = f" ({a.get('current_temperature')}°, objetivo {a.get('temperature')}°)"
            elif st.domain == "light" and st.state == "on" and a.get("brightness"):
                extra = f" ({round(a['brightness'] / 2.55)}%)"
            elif st.domain == "media_player" and a.get("media_title"):
                extra = f" ({a.get('media_artist', '')} - {a['media_title']})"
            out.append(f"{e['id']}={st.state}{extra}")
    temps = [f"{s.attributes.get('friendly_name', s.entity_id)}: {s.state}°" for s in hass.states.async_all("sensor") if s.attributes.get("device_class") == "temperature" and s.state not in ("unknown", "unavailable")][:12]
    return "Estados ahora: " + "; ".join(out) + (("\nTemperaturas: " + "; ".join(temps)) if temps else "")


def validate_actions(hass: HomeAssistant, allowed_ids: set[str], acciones: list[dict[str, Any]]) -> tuple[list[tuple[str, str, dict[str, Any]]], list[str]]:
    """Sólo pasan acciones sobre equipos del catálogo y servicios permitidos para su dominio."""
    calls: list[tuple[str, str, dict[str, Any]]] = []
    skipped: list[str] = []
    for a in acciones or []:
        domain, _, service = str(a.get("servicio", "")).partition(".")
        ids = [i for i in a.get("entity_ids") or [] if isinstance(i, str)]
        if domain not in ALLOWED or service not in ALLOWED[domain]:
            skipped.append(str(a.get("servicio")))
            continue
        if domain in ("music_assistant", "matterai"):
            good = [i for i in ids if i in allowed_ids and i.startswith("media_player.")]
        else:
            good = [i for i in ids if i in allowed_ids and i.split(".")[0] == domain]
        if not good:
            skipped.append(f"{a.get('servicio')} {ids}")
            continue
        data: dict[str, Any] = {"entity_id": good}
        if domain == "light" and service == "turn_on" and a.get("brightness_pct") is not None:
            data["brightness_pct"] = max(1, min(100, int(a["brightness_pct"])))
        if domain == "climate" and service == "set_temperature" and a.get("temperature") is not None:
            data["temperature"] = float(a["temperature"])
            if a.get("hvac_mode"):
                data["hvac_mode"] = a["hvac_mode"]
        if a.get("hvac_mode") not in (None, "off", "cool", "heat", "heat_cool", "auto", "dry", "fan_only"):
            a["hvac_mode"] = None
        if domain == "climate" and service == "set_hvac_mode":
            if not a.get("hvac_mode"):
                skipped.append(str(a.get("servicio")))
                continue
            data["hvac_mode"] = a["hvac_mode"]
        if domain == "cover" and service == "set_cover_position":
            if a.get("position") is None:
                skipped.append(str(a.get("servicio")))
                continue
            data["position"] = max(0, min(100, int(a["position"])))
        if domain == "fan" and service == "set_percentage" and a.get("percentage") is not None:
            data["percentage"] = max(0, min(100, int(a["percentage"])))
        if domain == "media_player" and service == "volume_set":
            if a.get("volume_level") is None:
                skipped.append(str(a.get("servicio")))
                continue
            v = float(a["volume_level"])
            data["volume_level"] = max(0.0, min(1.0, v / 100 if v > 1 else v))
        if domain == "media_player" and service == "volume_mute":
            data["is_volume_muted"] = bool(a.get("mute", True))
        if domain == "media_player" and service == "shuffle_set":
            data["shuffle"] = bool(a.get("shuffle", True))
        if domain == "media_player" and service == "repeat_set":
            data["repeat"] = a.get("repeat") if a.get("repeat") in ("off", "one", "all") else "all"
        if domain == "music_assistant" and service == "transfer_queue":
            src = a.get("source_player")
            if not isinstance(src, str) or not src.startswith("media_player."):
                skipped.append(str(a.get("servicio")))
                continue
            data["source_player"] = src
            data["auto_play"] = True
        if domain == "music_assistant" and service == "play_media":
            if not a.get("media_query"):
                skipped.append(str(a.get("servicio")))
                continue
            data["media_id"] = a["media_query"]
            if a.get("media_type") in ("artist", "track", "album", "playlist", "radio"):
                data["media_type"] = a["media_type"]
            if a.get("media_artist"):
                data["artist"] = str(a["media_artist"])
            if a.get("media_album"):
                data["album"] = str(a["media_album"])
            if a.get("enqueue") in ("play", "replace", "next", "replace_next", "add"):
                data["enqueue"] = a["enqueue"]
            if a.get("radio_mode"):
                data["radio_mode"] = True
        if domain == "matterai" and a.get("media_query"):
            data["media_id"] = a["media_query"]
        if domain == "matterai" and a.get("media_type") == "radio":
            data["media_type"] = "radio"
        if domain == "media_player" and service == "media_seek":
            data["seek_position"] = max(0, int(a.get("seek_position") or 0))
        calls.append((domain, service, data))
    return calls, skipped


MODES = ("local", "auto", "ai")  # gratis · gratis y, si no entiende, IA · siempre IA
NOT_UNDERSTOOD = "No te entendí. Probá con algo como «prendé la luz del living» o «poné el aire en 23»."


class VoiceBrain:
    """Entiende el pedido (gratis con el intérprete local y/o con IA) y lo ejecuta."""

    def __init__(self, hass: HomeAssistant, api_key: str | None, mode: str = "auto") -> None:
        self.hass = hass
        self.api_key = api_key or None
        self.mode = mode if mode in MODES else "auto"
        if self.mode == "ai" and not self.api_key:
            self.mode = "local"  # sin clave no hay IA: queda el modo gratis
        self._client = None
        self.log = None  # VoiceLog: lo que el modo gratis no entendió
        self.memo: dict[str, Any] = {}  # entre pedidos: el último parlante usado

    def _note(self, text: str, why: str, say: str = "") -> None:
        if self.log is not None:
            self.log.add(text, why, say)

    async def _play_something(self, data: dict[str, Any], context: Context) -> None:
        """"Poné música": lo que configuró el instalador; si no, una lista favorita al azar de Music Assistant."""
        eids = data["entity_id"]
        if data.get("media_id"):
            await self.hass.services.async_call("music_assistant", "play_media", {"entity_id": eids, "media_id": data["media_id"]}, blocking=False, context=context)
            return
        entries = self.hass.config_entries.async_entries("music_assistant")
        order = (("radio", True), ("radio", False)) if data.get("media_type") == "radio" else (("playlist", True), ("track", True), ("playlist", False))
        for media_type, favorite in order:
            if not entries:
                break
            try:
                res = await self.hass.services.async_call(
                    "music_assistant", "get_library",
                    {"config_entry_id": entries[0].entry_id, "media_type": media_type, "favorite": favorite, "limit": 1, "order_by": "random"},
                    blocking=True, return_response=True, context=context,
                )
            except Exception:  # noqa: BLE001 - versión de Music Assistant sin esa opción: se prueba otra
                continue
            items = (res or {}).get("items") or []
            if items and items[0].get("uri"):
                play = {"entity_id": eids, "media_id": items[0]["uri"], "media_type": media_type}
                if media_type == "track":
                    play["radio_mode"] = True  # una canción favorita y después parecidas
                await self.hass.services.async_call("music_assistant", "play_media", play, blocking=False, context=context)
                return
        await self.hass.services.async_call("media_player", "media_play", {"entity_id": eids}, blocking=False, context=context)

    @property
    def uses_ai(self) -> bool:
        return bool(self.api_key) and self.mode != "local"

    async def _get_client(self):
        if self._client is None:
            import anthropic  # noqa: PLC0415 - se importa recién cuando se usa la IA

            # crear el cliente lee certificados del disco: fuera del loop de HA
            self._client = await self.hass.async_add_executor_job(lambda: anthropic.AsyncAnthropic(api_key=self.api_key, timeout=30.0, max_retries=1))
        return self._client

    async def _ask_ai(self, text: str, rooms: list[dict[str, Any]]) -> dict[str, Any]:
        """Devuelve {"acciones", "respuesta"} o {"error": "texto para decir"}."""
        import anthropic  # noqa: PLC0415

        catalog = json.dumps(rooms, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        client = await self._get_client()
        try:
            resp = await client.messages.create(
                model=MODEL,
                max_tokens=2000,
                system=[
                    {"type": "text", "text": SYSTEM_RULES},
                    # el catálogo de la casa casi no cambia: queda en caché entre pedidos
                    {"type": "text", "text": "Equipos de la casa (por ambiente):\n" + catalog, "cache_control": {"type": "ephemeral"}},
                ],
                tools=[TOOL],
                messages=[{"role": "user", "content": _states_line(self.hass, rooms) + "\n\nPedido: " + text.strip()}],
                # campos nuevos por extra_body/headers: funciona con cualquier versión del SDK que tenga HA
                extra_headers={"anthropic-beta": FALLBACK_BETA},
                extra_body={"output_config": {"effort": "low"}, "fallbacks": "default"},
            )
        except anthropic.AuthenticationError:
            return {"error": "La clave de la inteligencia artificial no es válida. Avisale a tu instalador."}
        except anthropic.RateLimitError:
            return {"error": "Estoy con muchos pedidos, probá de nuevo en un ratito."}
        except anthropic.APIConnectionError:
            return {"error": "No me pude conectar. Revisá internet e intentá otra vez."}
        except anthropic.APIStatusError as err:
            _LOGGER.warning("Voz: error de la API (%s): %s", err.status_code, err)
            return {"error": "Tuve un problema para entenderte, probá de nuevo."}
        if resp.stop_reason == "refusal":
            return {"acciones": [], "respuesta": "Eso no lo puedo hacer."}
        call = next((b for b in resp.content if getattr(b, "type", "") == "tool_use" and b.name == "ejecutar"), None)
        if call is None:
            text_out = " ".join(getattr(b, "text", "") for b in resp.content if getattr(b, "type", "") == "text").strip()
            return {"acciones": [], "respuesta": text_out or NOT_UNDERSTOOD}
        return call.input if isinstance(call.input, dict) else json.loads(call.input)

    async def async_handle(self, text: str, config: dict[str, Any], context: Context) -> dict[str, Any]:
        from .local_voice import interpret  # noqa: PLC0415

        rooms = house_catalog(self.hass, config)
        allowed_ids = {e["id"] for r in rooms for e in r["equipos"]}
        data, source = None, "local"
        if self.mode != "ai":
            try:
                self.memo["music_default"] = config.get("music_default")  # "poné música" sin decir qué
                data = interpret(self.hass, rooms, text, self.memo)
            except Exception:  # noqa: BLE001 - si el intérprete falla con una frase rara, sigue la IA (o "no entendí")
                _LOGGER.exception("Voz: el intérprete gratis falló con «%s»", text)
                data = None
        if data is None and self.uses_ai:
            data, source = await self._ask_ai(text, rooms), "ia"
            if self.mode != "ai":
                self._note(text, "ia", str(data.get("respuesta") or data.get("error") or ""))
            if "error" in data:
                return {"ok": False, "say": data["error"], "actions": [], "source": source}
        if data is None:
            self._note(text, "no")
            return {"ok": True, "say": NOT_UNDERSTOOD, "actions": [], "source": source, "understood": False}
        if source == "local" and not data.get("acciones"):
            resp = str(data.get("respuesta") or "")
            if "?" in resp and not resp.startswith(("Sí", "No")):
                self._note(text, "duda", resp)  # preguntó de vuelta (por ejemplo, "¿en qué ambiente?")
        calls, skipped = validate_actions(self.hass, allowed_ids, data.get("acciones") or [])
        done = []
        for domain, service, sdata in calls:
            try:
                if domain == "matterai":
                    await self._play_something(sdata, context)
                    done.append({"service": "music_assistant.play_media", "entities": sdata["entity_id"], "ok": True})
                    continue
                await self.hass.services.async_call(domain, service, sdata, blocking=False, context=context)
                done.append({"service": f"{domain}.{service}", "entities": sdata["entity_id"], "ok": True})
            except Exception as err:  # noqa: BLE001 - una acción que falla no frena las demás
                _LOGGER.warning("Voz: falló %s.%s %s: %s", domain, service, sdata, err)
                done.append({"service": f"{domain}.{service}", "entities": sdata["entity_id"], "ok": False})
        say = str(data.get("respuesta") or "").strip() or "Listo."
        if calls and not any(d["ok"] for d in done):
            say = "No pude hacerlo, puede que el equipo no esté respondiendo."
        if skipped:
            _LOGGER.info("Voz: acciones descartadas %s (pedido: %s)", skipped, text)
        return {"ok": True, "say": say, "actions": done, "source": source}
