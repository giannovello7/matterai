"""El cerebro de Matte: una conversación con Claude que usa herramientas de la casa.

Reglas que no dependen del modelo (las hace cumplir el código, no el texto del prompt):
- Los equipos se manejan sólo si están en el catálogo de la casa y con servicios permitidos (los mismos de la voz).
  Cerraduras, alarma y portones nunca por Matte: eso se hace desde la app.
- Crear, cambiar, pausar o borrar una automatización es una PROPUESTA: queda esperando el «dale».
  Se aplica tocando «Sí» en la app, o si Matte la aplica en un turno POSTERIOR (la persona tuvo que contestar).
  Lo que toca cerraduras, alarma o portones sólo se aplica desde la app, con doble confirmación.
- Los permisos del motor de automatizaciones son los de la persona que habla (los parlantes de la casa, que no
  tienen usuario, nunca valen como administrador).
- La memoria no guarda claves, tarjetas ni documentos.
"""

from __future__ import annotations

import json
import logging
import secrets
import time
from types import SimpleNamespace
from typing import Any

from homeassistant.core import Context, HomeAssistant
from homeassistant.util import dt as dt_util

from ..const import DOMAIN
from ..voice import ALLOWED, FALLBACK_BETA, MODEL, TOOL as VOICE_TOOL, _states_line, house_catalog, validate_actions
from .memoria import Memoria
from .reglas import KINDS_MATTE, ReglaError, compile_rule, es_sensible

_LOGGER = logging.getLogger(__name__)

ESCENAS = "matterai_escenas"
SESION_VENCE = 3 * 3600
MAX_RONDAS = 8
MAX_MENSAJES = 70
DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]

SYSTEM = """Sos Matte, la inteligencia artificial de esta casa (sistema MatterAI). Sos secretaria, amiga y asistente de todos los que viven acá: charlás de cualquier tema, ayudás a organizar el día, respondés preguntas y manejás la casa.

Cómo hablás: castellano rioplatense, con voseo, cálido, natural y con humor cuando viene al caso. Directo y corto: si te escuchan por voz, una o dos oraciones; por escrito podés extenderte un poco si hace falta. Nunca uses jerga técnica con la familia (nada de entity_id, YAML, Home Assistant, MQTT, Zigbee): para ellos son «la luz del living», «el sensor de la puerta».

La casa:
- Usá las herramientas para saber cómo está la casa (ver_estados, quien_esta) en vez de suponer. Si preguntan si hay alguien, respondé con datos reales y decí de dónde lo sabés («Sofi está en casa según su celular; hubo movimiento en el living hace 5 minutos»). Si no hay forma de saberlo, decilo.
- Para prender, apagar, subir o poner música: controlar. Sólo con equipos del catálogo, con su id exacto. Cerraduras, alarma y portones NO los podés manejar: decí que eso se hace desde la app por seguridad.

Automatizaciones, escenas y recordatorios (lo más importante):
- NUNCA crees, cambies, pauses ni borres nada sin preguntar. Primero entendé qué quiere; si falta un dato que cambia el resultado, preguntá (una cosa por vez). Después llamá a proponer con una explicación en palabras simples y preguntá si te da el «dale». La app le muestra botones Sí / Cambiar / No.
- Si en su respuesta siguiente dice que sí, llamá a aplicar con el id de la propuesta. Si pide un cambio, hacé una propuesta nueva. Si dice que no, aplicá descartar y no vuelvas a ofrecer lo mismo.
- Interpretá modificaciones: «cambiá la de la siesta a las 15», «que no se active los domingos», «sacá la de las luces». Buscá la automatización (ver_automatizaciones / ver_automatizacion), proponé el cambio sobre ESA (accion cambiar con su rule_id, o pausar/borrar) y explicá qué cambia.
- Proponé cosas con sentido para la vida de la familia, no lo primero que se te ocurre. Ejemplo: «Tomi duerme la siesta de 14 a 16» → bajar la persiana de su cuarto, que los parlantes no hagan anuncios y que el timbre avise sólo al celular. Usá lo que la casa tiene de verdad (catalogo_reglas): si falta un sensor, no lo inventes; ofrecé otra forma o sugerí sumarlo.
- Lo que tenga cerraduras, alarma o portones se puede proponer, pero se confirma dos veces en la app.
- Las reglas se arman con el modelo del panel (campo regla). Tipos: scene (botón para tocar: ui.actions), auto (ui.triggers + ui.conditions + ui.cond_mode all/any + ui.actions), period (encender equipos en un horario: ui.entities, ui.on y ui.off {type: time, at: HH:MM} o {type: sunrise/sunset, offset: minutos}, ui.days), reminder (ui.text, ui.date AAAA-MM-DD, ui.time HH:MM, ui.repeat none/daily/weekly/monthly/yearly, ui.days para weekly).
  Disparadores: {type: time, at, days}, {type: sun, event: sunrise/sunset, offset, days}, {type: device, entity, to (estado) o dir above/below + value, for_min}, {type: presence, who: person.x | first | last, event: arrive/leave}, {type: interval, every, unit: m/h}.
  Condiciones: {type: time, after, before, days}, {type: sun, when: day/night}, {type: device, entity, state o dir+value}, {type: presence, who: person.x | anyone | nobody, where: home/away}.
  Acciones: {type: device, entity, svc: dominio.servicio, params: {brightness_pct, temperature, position, _off_after (minutos)...}}, {type: area, domain, op: on/off/open/close/pause, area: area_id | all}, {type: scene, entity}, {type: notify, target: mobile_app_x, message, title}, {type: delay, h, m, s}, {type: rule, op: run/enable/disable, rule_id}.
  Días: mon tue wed thu fri sat sun. Los recordatorios llegan solos al celular de quien los pidió.

Memoria:
- Recordá lo que sirve para ayudar mejor: rutinas, gustos, nombres, quién es quién, cómo le dicen a cada cosa («la luz grande» = el techo del living). Llamá a recordar en el momento, con una frase corta y clara; de_la_casa true si es de todos (horarios de la casa, mascotas, quién vive) y false si es de la persona que habla.
- Nunca guardes claves, tarjetas, documentos, salud ni temas delicados salvo que te lo pidan explícitamente.
- Si te piden olvidar algo, olvidar. Si preguntan qué sabés, contalo.
- No anuncies cada cosa que anotás; como mucho un «me lo anoto».

Siempre:
- Usá sólo ids que estén en el catálogo o que te devolvieron las herramientas. Nunca inventes.
- Si una herramienta devuelve ok false, contá el problema en simple y qué se puede hacer.
- La hora y quién te habla vienen al principio de cada mensaje, entre corchetes.
"""

TOOLS: list[dict[str, Any]] = [
    {"name": "controlar", "description": "Maneja equipos de la casa ya mismo (luces, aire, persianas, música, escenas de la casa). No sirve para cerraduras, alarma ni portones.",
     "input_schema": {"type": "object", "additionalProperties": False, "required": ["acciones"], "properties": {"acciones": VOICE_TOOL["input_schema"]["properties"]["acciones"]}}},
    {"name": "ver_estados", "description": "Cómo están ahora los equipos (todos o de un ambiente).",
     "input_schema": {"type": "object", "properties": {"ambiente": {"type": "string", "description": "nombre del ambiente; vacío = toda la casa"}}}},
    {"name": "quien_esta", "description": "Quién está en casa y qué pasó hace poco: celulares de la familia (ubicación), movimiento, puertas y ventanas abiertas.", "input_schema": {"type": "object", "properties": {}}},
    {"name": "catalogo_reglas", "description": "Todo lo que se puede usar para armar automatizaciones: sensores, personas, zonas, ambientes (area_id), celulares para avisos y equipos delicados.", "input_schema": {"type": "object", "properties": {}}},
    {"name": "ver_automatizaciones", "description": "Lista de automatizaciones, escenas y recordatorios de la casa (id, nombre, tipo, si está activa).", "input_schema": {"type": "object", "properties": {}}},
    {"name": "ver_automatizacion", "description": "El detalle de una automatización (su modelo completo, para proponer un cambio).",
     "input_schema": {"type": "object", "required": ["rule_id"], "properties": {"rule_id": {"type": "string"}}}},
    {"name": "proponer", "description": "Propone crear, cambiar, pausar, activar o borrar una automatización, escena o recordatorio. NO lo aplica: queda esperando el «dale» de la persona.",
     "input_schema": {"type": "object", "required": ["accion", "titulo", "explicacion"], "properties": {
         "accion": {"type": "string", "enum": ["crear", "cambiar", "pausar", "activar", "borrar"]},
         "titulo": {"type": "string", "description": "nombre corto, como lo vería la familia («Siesta de Tomi»)"},
         "explicacion": {"type": "string", "description": "qué hace (o qué cambia), en palabras simples, en una o dos oraciones"},
         "rule_id": {"type": "string", "description": "para cambiar, pausar, activar o borrar"},
         "regla": {"type": "object", "description": "para crear o cambiar: {kind, name, ui} con el modelo del panel"},
     }}},
    {"name": "aplicar", "description": "Aplica una propuesta a la que la persona ya le dijo que sí en su último mensaje.",
     "input_schema": {"type": "object", "required": ["propuesta_id"], "properties": {"propuesta_id": {"type": "string"}}}},
    {"name": "descartar", "description": "La persona dijo que no a una propuesta: se descarta y no se vuelve a ofrecer.",
     "input_schema": {"type": "object", "required": ["propuesta_id"], "properties": {"propuesta_id": {"type": "string"}}}},
    {"name": "ejecutar_escena", "description": "Ejecuta ya una escena (o rutina de buenas noches / despertador) de las automatizaciones de la casa.",
     "input_schema": {"type": "object", "required": ["rule_id"], "properties": {"rule_id": {"type": "string"}}}},
    {"name": "recordar", "description": "Anota algo útil para recordar (una frase corta).",
     "input_schema": {"type": "object", "required": ["texto", "de_la_casa"], "properties": {"texto": {"type": "string"}, "de_la_casa": {"type": "boolean"}}}},
    {"name": "olvidar", "description": "Borra algo de la memoria (id de lo que sabés).",
     "input_schema": {"type": "object", "required": ["id"], "properties": {"id": {"type": "string"}}}},
]


def _dump(block: Any) -> dict[str, Any]:
    if isinstance(block, dict):
        return block
    if hasattr(block, "model_dump"):
        return block.model_dump(exclude_none=True)
    return dict(vars(block))


def _hace(dt) -> str:
    if dt is None:
        return ""
    mins = int((dt_util.utcnow() - dt).total_seconds() // 60)
    if mins < 1:
        return "recién"
    if mins < 60:
        return f"hace {mins} min"
    if mins < 60 * 24:
        return f"hace {mins // 60} h"
    return f"hace {mins // 1440} días"


class Asistente:
    def __init__(self, hass: HomeAssistant, api_key_fn) -> None:
        self.hass = hass
        self._api_key_fn = api_key_fn  # la clave puede cambiar en las opciones sin reiniciar
        self.memoria = Memoria(hass)
        self.sesiones: dict[str, dict[str, Any]] = {}
        self._client = None
        self._client_key: str | None = None

    async def async_load(self) -> None:
        await self.memoria.async_load()

    @property
    def disponible(self) -> bool:
        return bool(self._api_key_fn())

    # ------------------------------------------------------------ sesiones
    def _limpiar(self) -> None:
        now = time.time()
        for sid in [k for k, s in self.sesiones.items() if now - s["t"] > SESION_VENCE]:
            self.sesiones.pop(sid, None)

    def sesion(self, uid: str | None, session_id: str | None) -> dict[str, Any]:
        self._limpiar()
        s = self.sesiones.get(session_id or "")
        if s is None or s["uid"] != uid:
            sid = session_id if session_id and len(session_id) <= 64 and session_id not in self.sesiones else secrets.token_urlsafe(12)
            s = {"id": sid, "uid": uid, "messages": [], "turno": 0, "propuestas": {}, "t": time.time(), "previo": ""}
            self.sesiones[sid] = s
        s["t"] = time.time()
        return s

    def _renovar(self, s: dict[str, Any]) -> dict[str, Any]:
        """Conversación muy larga: se sigue en una nueva con un resumen de lo último (la historia no se edita)."""
        ult: list[str] = []
        for m in s["messages"][-12:]:
            if m["role"] == "user" and isinstance(m["content"], str):
                ult.append("Persona: " + m["content"].split("] ", 1)[-1][:300])
            elif m["role"] == "assistant":
                txt = " ".join(str(b.get("text") or "") for b in m["content"] if isinstance(b, dict) and b.get("type") == "text").strip()
                if txt:
                    ult.append("Matte: " + txt[:300])
        nueva = {"id": s["id"], "uid": s["uid"], "messages": [], "turno": s["turno"], "propuestas": s["propuestas"], "t": time.time(), "previo": "\n".join(ult[-6:])}
        self.sesiones[s["id"]] = nueva
        return nueva

    # ------------------------------------------------------------ contexto
    def _rooms(self) -> list[dict[str, Any]]:
        rt = self.hass.data.get(DOMAIN) or {}
        dash = rt.get("dashboard")
        return house_catalog(self.hass, dash.config if dash else {})

    def _cabecera(self, user, origen: str) -> str:
        now = dt_util.now()
        quien = getattr(user, "name", None) or "alguien de la casa (por un parlante, sin saber quién)"
        voz = " · por voz: respondé corto" if origen == "voz" else " · por escrito en la app"
        return f"[{DIAS[now.weekday()]} {now.day}/{now.month}/{now.year} {now.hour:02d}:{now.minute:02d} · habla {quien}{voz}] "

    def _memoria_txt(self, uid: str | None) -> str:
        m = self.memoria.de(uid)
        partes = []
        if m["casa"]:
            partes.append("De la casa:\n" + "\n".join(f"- ({x['id']}) {x['texto']}" for x in m["casa"]))
        if m["mia"]:
            partes.append("De quien te habla:\n" + "\n".join(f"- ({x['id']}) {x['texto']}" for x in m["mia"]))
        rech = self.memoria.rechazos(uid)
        if rech:
            partes.append("Propuestas que ya rechazó (no las vuelvas a ofrecer): " + "; ".join(rech))
        return "Lo que sabés:\n" + ("\n\n".join(partes) if partes else "Todavía nada: andá conociendo a la familia.")

    # ------------------------------------------------------------ IA
    async def _cliente(self, key: str):
        if self._client is None or self._client_key != key:
            import anthropic  # noqa: PLC0415

            self._client = await self.hass.async_add_executor_job(lambda: anthropic.AsyncAnthropic(api_key=key, timeout=90.0, max_retries=1))
            self._client_key = key
        return self._client

    async def _llamar(self, client, catalog: str, memoria: str, messages: list[dict[str, Any]]):
        tools = [*TOOLS[:-1], {**TOOLS[-1], "cache_control": {"type": "ephemeral"}}]
        return await client.messages.create(
            model=MODEL,
            max_tokens=4000,
            system=[
                {"type": "text", "text": SYSTEM},
                {"type": "text", "text": "Catálogo de la casa (ambientes y equipos que podés manejar):\n" + catalog, "cache_control": {"type": "ephemeral"}},
                {"type": "text", "text": memoria},
            ],
            tools=tools,
            messages=messages,
            extra_headers={"anthropic-beta": FALLBACK_BETA},
            extra_body={"output_config": {"effort": "low"}, "fallbacks": "default"},
        )

    # ------------------------------------------------------------ conversar
    async def conversar(self, user, texto: str, session_id: str | None = None, origen: str = "app") -> dict[str, Any]:
        key = self._api_key_fn()
        uid = getattr(user, "id", None)
        if not key:
            return {"ok": False, "say": "Para charlar conmigo hace falta activar la inteligencia artificial en la casa. Avisale a tu instalador.", "sin_ia": True}
        s = self.sesion(uid, session_id)
        if len(s["messages"]) > MAX_MENSAJES:
            s = self._renovar(s)
        s["turno"] += 1
        rooms = self._rooms()
        ctx = {"user": user, "uid": uid, "origen": origen, "rooms": rooms, "allowed": {e["id"] for r in rooms for e in r["equipos"]}, "s": s, "acciones": [], "nuevas": []}
        previo = f"(Lo último que venían hablando:\n{s['previo']})\n" if s.get("previo") and not s["messages"] else ""
        if s.get("previo_nota"):  # lo que tocó en los botones desde el último mensaje (se borra si el turno sale bien)
            previo += s["previo_nota"] + "\n"
        n0 = len(s["messages"])
        s["messages"].append({"role": "user", "content": self._cabecera(user, origen) + previo + str(texto or "").strip()[:2000]})
        catalog = json.dumps(rooms, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        say = ""
        try:
            client = await self._cliente(key)
            for _ in range(MAX_RONDAS):
                resp = await self._llamar(client, catalog, self._memoria_txt(uid), s["messages"])
                if getattr(resp, "stop_reason", "") == "refusal":
                    del s["messages"][n0:]
                    return {"ok": True, "session_id": s["id"], "say": "Eso no lo puedo hacer.", "propuestas": [], "acciones": []}
                blocks = [_dump(b) for b in resp.content]
                s["messages"].append({"role": "assistant", "content": blocks})
                say = " ".join(str(b.get("text") or "") for b in blocks if b.get("type") == "text").strip() or say
                uses = [b for b in blocks if b.get("type") == "tool_use"]
                if not uses:
                    break
                results = []
                for u in uses:
                    out = await self._herramienta(ctx, str(u.get("name")), dict(u.get("input") or {}))
                    results.append({"type": "tool_result", "tool_use_id": u.get("id"), "content": json.dumps(out, ensure_ascii=False, default=str)[:8000], **({"is_error": True} if out.get("ok") is False else {})})
                s["messages"].append({"role": "user", "content": results})
            else:
                s["messages"].append({"role": "assistant", "content": [{"type": "text", "text": say or "Listo."}]})
        except Exception as err:  # noqa: BLE001 - la conversación nunca rompe la app
            _LOGGER.warning("Matte: error de la IA (%s: %s)", type(err).__name__, err)
            del s["messages"][n0:]  # la conversación queda coherente: se descarta el turno a medias
            return {"ok": False, "session_id": s["id"], "say": _error_say(err), "propuestas": [], "acciones": []}
        s.pop("previo_nota", None)
        pend = [self._publica(p) for p in s["propuestas"].values() if p["estado"] == "pendiente" and p["id"] in ctx["nuevas"]]
        return {"ok": True, "session_id": s["id"], "say": say or "Listo.", "propuestas": pend, "acciones": ctx["acciones"], "pregunta": say.rstrip().endswith("?")}

    @staticmethod
    def _publica(p: dict[str, Any]) -> dict[str, Any]:
        return {"id": p["id"], "accion": p["accion"], "titulo": p["titulo"], "explicacion": p["explicacion"], "sensible": p["sensible"]}

    # ------------------------------------------------------------ confirmar desde la app (botones)
    async def confirmar(self, user, session_id: str, propuesta_id: str, si: bool, segura: bool = False) -> dict[str, Any]:
        uid = getattr(user, "id", None)
        s = self.sesiones.get(session_id or "")
        if s is None or s["uid"] != uid:
            return {"ok": False, "say": "Esa propuesta ya venció. Pedímela de nuevo."}
        p = s["propuestas"].get(propuesta_id)
        if p is None or p["estado"] != "pendiente":
            return {"ok": False, "say": "Esa propuesta ya no está pendiente."}
        if not si:
            p["estado"] = "descartada"
            self.memoria.rechazar(uid, p["titulo"])
            self._nota(s, f"(La persona tocó «No» en la propuesta «{p['titulo']}».)")
            return {"ok": True, "say": "Listo, no la armo."}
        if p["sensible"] and not segura:
            return {"ok": False, "necesita_segunda": True, "say": "Esto toca cerraduras, alarma o portones: confirmalo una vez más."}
        out = await self._aplicar_propuesta(user, p)
        self._nota(s, f"(La persona tocó «Sí» en «{p['titulo']}»: {'quedó hecho' if out.get('ok') else 'no se pudo: ' + str(out.get('error'))}.)")
        return {"ok": bool(out.get("ok")), "say": out.get("say") or out.get("error") or "Listo."}

    @staticmethod
    def _nota(s: dict[str, Any], texto: str) -> None:
        """Lo que pasó con los botones, para que Matte lo sepa en el próximo mensaje."""
        s["previo_nota"] = (s.get("previo_nota", "") + " " + texto).strip()

    # ------------------------------------------------------------ herramientas
    async def _herramienta(self, ctx: dict[str, Any], name: str, args: dict[str, Any]) -> dict[str, Any]:
        fn = getattr(self, f"_t_{name}", None)
        if fn is None:
            return {"ok": False, "error": "Esa herramienta no existe."}
        try:
            out = await fn(ctx, args)
        except ReglaError as err:
            return {"ok": False, "error": str(err)}
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning("Matte: la herramienta %s falló: %s", name, err)
            return {"ok": False, "error": str(err) or "No se pudo."}
        return {"ok": True, **out} if "ok" not in out else out

    def _actor(self, ctx: dict[str, Any]):
        # un parlante sin usuario NUNCA vale como administrador (el motor trata «sin usuario» como sistema)
        return ctx["user"] if ctx["user"] is not None else SimpleNamespace(id=None, name="Matte", is_admin=False)

    async def _t_controlar(self, ctx, args):
        calls, skipped = validate_actions(self.hass, ctx["allowed"], args.get("acciones") or [])
        done = []
        context = Context(user_id=ctx["uid"])
        rt = self.hass.data.get(DOMAIN) or {}
        for domain, service, sdata in calls:
            try:
                if domain == "matterai":
                    brain = rt.get("voice")
                    if brain is not None:
                        await brain._play_something(sdata, context)  # noqa: SLF001
                    else:
                        await self.hass.services.async_call("media_player", "media_play", {"entity_id": sdata["entity_id"]}, blocking=False, context=context)
                else:
                    await self.hass.services.async_call(domain, service, sdata, blocking=False, context=context)
                done.append({"service": f"{domain}.{service}", "entities": sdata["entity_id"], "ok": True})
            except Exception as err:  # noqa: BLE001 - una que falla no frena las demás
                done.append({"service": f"{domain}.{service}", "entities": sdata["entity_id"], "ok": False, "error": str(err)})
        ctx["acciones"] += done
        return {"hechas": done, "descartadas": skipped}

    async def _t_ver_estados(self, ctx, args):
        rooms = ctx["rooms"]
        amb = str(args.get("ambiente") or "").strip().lower()
        if amb:
            rooms = [r for r in rooms if amb in r["ambiente"].lower()] or rooms
        return {"estados": _states_line(self.hass, rooms)}

    async def _t_quien_esta(self, ctx, args):
        from ..selection import is_allowed  # noqa: PLC0415

        S = self.hass.states
        personas = []
        for st in S.async_all("person"):
            personas.append({"persona": st.attributes.get("friendly_name") or st.entity_id, "id": st.entity_id,
                             "donde": "en casa" if st.state == "home" else "afuera" if st.state == "not_home" else st.state, "desde": _hace(st.last_changed)})
        movimiento, aberturas = [], []
        for st in S.async_all("binary_sensor"):
            if not is_allowed(self.hass, st.entity_id):
                continue
            dc = st.attributes.get("device_class")
            name = st.attributes.get("friendly_name") or st.entity_id
            if dc in ("motion", "occupancy", "presence"):
                recent = (dt_util.utcnow() - st.last_changed).total_seconds() < 3600
                if st.state == "on" or recent:
                    movimiento.append({"sensor": name, "ahora": st.state == "on", "ultimo_cambio": _hace(st.last_changed)})
            elif dc in ("door", "garage_door", "window", "opening") and st.state == "on":
                aberturas.append({"sensor": name, "abierta": _hace(st.last_changed)})
        casa = S.get("zone.home")
        return {"personas": personas, "personas_en_casa_segun_celulares": casa.state if casa else None, "movimiento_ultima_hora": movimiento[:20], "abiertas": aberturas[:20],
                "nota": "Sin personas cargadas: sólo hay sensores." if not personas else ""}

    async def _t_catalogo_reglas(self, ctx, args):
        from homeassistant.helpers import area_registry as ar  # noqa: PLC0415

        from ..escenas.notify import APP_ID  # noqa: PLC0415
        from ..selection import is_allowed  # noqa: PLC0415

        S = self.hass.states
        sens = []
        for st in S.async_all(("binary_sensor", "sensor")):
            dc = st.attributes.get("device_class")
            if not dc or not is_allowed(self.hass, st.entity_id):
                continue
            if st.domain == "sensor" and dc not in ("temperature", "humidity", "illuminance", "power", "battery", "moisture"):
                continue
            sens.append({"id": st.entity_id, "nombre": st.attributes.get("friendly_name") or st.entity_id, "tipo": dc, "estado": st.state})
        from homeassistant.util import slugify  # noqa: PLC0415

        cel = []
        for e in self.hass.config_entries.async_entries("mobile_app"):
            if e.data.get("app_id") != APP_ID:
                continue
            name = f"mobile_app_{slugify(e.data.get('device_name') or '')}"
            user = await self.hass.auth.async_get_user(e.data["user_id"]) if e.data.get("user_id") else None
            cel.append({"target": name, "equipo": e.data.get("device_name"), "de": user.name if user else None})
        delicados = [{"id": st.entity_id, "nombre": st.attributes.get("friendly_name")} for st in S.async_all(("lock", "alarm_control_panel", "cover"))
                     if (st.domain != "cover" or st.attributes.get("device_class") in ("garage", "gate")) and is_allowed(self.hass, st.entity_id)]
        return {
            "sensores": sens[:120],
            "personas": [{"id": st.entity_id, "nombre": st.attributes.get("friendly_name")} for st in S.async_all("person")],
            "zonas": [{"id": st.entity_id, "nombre": st.attributes.get("friendly_name")} for st in S.async_all("zone")],
            "ambientes": [{"area_id": a.id, "nombre": a.name} for a in ar.async_get(self.hass).async_list_areas()],
            "celulares": cel,
            "delicados_se_confirman_en_la_app": delicados,
        }

    def _manager(self):
        m = self.hass.data.get(ESCENAS)
        if m is None:
            raise ReglaError("Las automatizaciones no están andando en esta casa.")
        return m

    async def _t_ver_automatizaciones(self, ctx, args):
        out = []
        for r in self._manager().as_list():
            item = {"id": r["id"], "nombre": r.get("name"), "tipo": r.get("kind"), "activa": r.get("enabled", True), "la_armo_el_instalador": bool(r.get("locked") or r.get("installer_only"))}
            if r.get("kind") == "reminder":
                u = r.get("ui") or {}
                item["recordatorio"] = f"{u.get('text')} · {u.get('date') or ''} {u.get('time') or ''} · {u.get('repeat')}"
            out.append(item)
        return {"automatizaciones": out}

    async def _t_ver_automatizacion(self, ctx, args):
        rid = str(args.get("rule_id") or "")
        r = self._manager().rules.get(rid)
        if r is None:
            return {"ok": False, "error": "No encuentro esa automatización."}
        editable = r.get("kind") in KINDS_MATTE and not r.get("locked")
        return {"id": rid, "nombre": r.get("name"), "tipo": r.get("kind"), "activa": r.get("enabled", True), "ui": r.get("ui"),
                "se_puede_cambiar": editable, "nota": "" if editable else "Esta se puede pausar, activar o borrar, pero los cambios se hacen en el panel (o la armó el instalador)."}

    async def _t_proponer(self, ctx, args):
        accion = args.get("accion")
        manager = self._manager()
        actor = self._actor(ctx)
        admin = bool(getattr(actor, "is_admin", False))
        prev = None
        regla: dict[str, Any] | None = None
        if accion in ("cambiar", "pausar", "activar", "borrar"):
            prev = manager.rules.get(str(args.get("rule_id") or ""))
            if prev is None:
                return {"ok": False, "error": "No encuentro esa automatización (usá ver_automatizaciones)."}
            if not admin and (prev.get("locked") or prev.get("kind") == "gate") and accion in ("cambiar", "borrar"):
                return {"ok": False, "error": "La armó el instalador: se puede pausar o activar, pero no cambiar ni borrar."}
        if accion in ("crear", "cambiar"):
            raw = dict(args.get("regla") or {})
            if accion == "cambiar":
                if prev.get("kind") not in KINDS_MATTE:
                    return {"ok": False, "error": "Ese tipo se cambia en el panel de Automatizaciones; desde acá se puede pausar, activar o borrar."}
                raw = {"icon": prev.get("icon"), "color": prev.get("color"), "kind": prev.get("kind"), "name": prev.get("name"), "enabled": prev.get("enabled", True), **raw, "id": prev["id"]}
            raw.setdefault("name", args.get("titulo"))
            if raw.get("kind") == "reminder":
                ui = raw.setdefault("ui", {})
                if not ui.get("recipients"):
                    ui["recipients"] = self._mis_celulares(ctx["uid"])
            regla = compile_rule(raw)
            if accion == "crear" and not admin and regla["kind"] in manager.settings.get("client_off", []):
                return {"ok": False, "error": "Tu instalador no habilitó ese tipo de automatización en esta casa."}
            from ..escenas.manager import InvalidRule  # noqa: PLC0415

            try:
                await manager.async_validate(dict(regla), admin)  # sólo valida (no guarda)
            except InvalidRule as err:
                return {"ok": False, "error": str(err)}
        s = ctx["s"]
        pid = secrets.token_hex(3)
        p = {"id": pid, "accion": accion, "titulo": str(args.get("titulo") or "")[:80], "explicacion": str(args.get("explicacion") or "")[:400],
             "rule_id": prev["id"] if prev else None, "regla": regla, "turno": s["turno"], "estado": "pendiente",
             "sensible": bool(regla and es_sensible(self.hass, regla)) or bool(prev and accion in ("borrar", "pausar") and es_sensible(self.hass, prev))}
        s["propuestas"][pid] = p
        ctx["nuevas"].append(pid)
        return {"propuesta_id": pid, "sensible": p["sensible"], "siguiente": "Contale la propuesta en simple y preguntá si le da el «dale». No la apliques en este turno."}

    def _mis_celulares(self, uid: str | None) -> list[str]:
        from homeassistant.util import slugify  # noqa: PLC0415

        from ..escenas.notify import APP_ID  # noqa: PLC0415

        out = []
        for e in self.hass.config_entries.async_entries("mobile_app"):
            if e.data.get("app_id") == APP_ID and uid and e.data.get("user_id") == uid:
                name = f"mobile_app_{slugify(e.data.get('device_name') or '')}"
                if self.hass.services.has_service("notify", name):
                    out.append(name)
        return out

    async def _t_aplicar(self, ctx, args):
        s = ctx["s"]
        p = s["propuestas"].get(str(args.get("propuesta_id") or ""))
        if p is None or p["estado"] != "pendiente":
            return {"ok": False, "error": "Esa propuesta no existe o ya no está pendiente."}
        if p["turno"] >= s["turno"]:
            return {"ok": False, "error": "Primero contale la propuesta y esperá que te diga que sí."}
        if p["sensible"]:
            return {"ok": False, "error": "Toca cerraduras, alarma o portones: se confirma tocando «Sí» en la app (dos veces)."}
        return await self._aplicar_propuesta(ctx["user"], p)

    async def _t_descartar(self, ctx, args):
        p = ctx["s"]["propuestas"].get(str(args.get("propuesta_id") or ""))
        if p is None or p["estado"] != "pendiente":
            return {"ok": False, "error": "Esa propuesta no está pendiente."}
        p["estado"] = "descartada"
        self.memoria.rechazar(ctx["uid"], p["titulo"])
        return {"descartada": True}

    async def _aplicar_propuesta(self, user, p: dict[str, Any]) -> dict[str, Any]:
        from ..escenas.manager import InvalidRule  # noqa: PLC0415

        manager = self._manager()
        actor = user if user is not None else SimpleNamespace(id=None, name="Matte", is_admin=False)
        try:
            if p["accion"] in ("crear", "cambiar"):
                rule = await manager.async_save(dict(p["regla"]), actor)
                p["rule_id"] = rule["id"]
            elif p["accion"] == "borrar":
                await manager.async_delete(p["rule_id"], actor)
            else:
                await manager.async_set_enabled(p["rule_id"], p["accion"] == "activar", actor)
        except InvalidRule as err:
            return {"ok": False, "error": str(err)}
        p["estado"] = "hecha"
        verbo = {"crear": "Listo, quedó armada", "cambiar": "Listo, la cambié", "borrar": "Listo, la borré", "pausar": "Listo, la pausé", "activar": "Listo, la activé"}[p["accion"]]
        return {"ok": True, "rule_id": p["rule_id"], "say": f"{verbo}: «{p['titulo']}»."}

    async def _t_ejecutar_escena(self, ctx, args):
        manager = self._manager()
        rid = str(args.get("rule_id") or "")
        r = manager.rules.get(rid)
        if r is None:
            return {"ok": False, "error": "No encuentro esa escena."}
        if r.get("kind") not in ("scene", "night", "wake", "reminder"):
            return {"ok": False, "error": "Eso no es una escena para ejecutar."}
        if es_sensible(self.hass, r):
            return {"ok": False, "error": "Esa escena toca cerraduras, alarma o portones: ejecutala desde la app."}
        await manager.async_run(rid, Context(user_id=ctx["uid"]))
        return {"ejecutada": r.get("name")}

    async def _t_recordar(self, ctx, args):
        return self.memoria.agregar(ctx["uid"], str(args.get("texto") or ""), bool(args.get("de_la_casa")))

    async def _t_olvidar(self, ctx, args):
        ok = self.memoria.borrar(ctx["uid"], str(args.get("id") or ""))
        return {"ok": ok, **({} if ok else {"error": "No encuentro eso en lo que sé."})}


def _error_say(err: Exception) -> str:
    name = type(err).__name__
    if name == "AuthenticationError":
        return "La clave de la inteligencia artificial no es válida. Avisale a tu instalador."
    if name == "RateLimitError":
        return "Estoy con muchos pedidos, probá de nuevo en un ratito."
    if name in ("APIConnectionError", "APITimeoutError"):
        return "No me pude conectar. Revisá internet e intentá otra vez."
    return "Tuve un problema para pensar eso. Probá de nuevo."


__all__ = ["Asistente", "ALLOWED"]
