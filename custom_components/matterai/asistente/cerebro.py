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
  Acciones: {type: device, entity, svc: dominio.servicio, params: {brightness_pct, temperature, position, _off_after (minutos)...}}, {type: area, domain, op: on/off/open/close/pause, area: area_id | all}, {type: scene, entity}, {type: notify, target: mobile_app_x, message, title, foto}, {type: delay, h, m, s}, {type: rule, op: run/enable/disable, rule_id}.
  Días: mon tue wed thu fri sat sun. Los recordatorios llegan solos al celular de quien los pidió.

Avisos con foto:
- Todo aviso queda también en la campanita de la app de la persona (30 días) y puede llevar la foto del momento. En la acción notify, foto es el id de una cámara (catalogo_reglas → camaras), "no" (sin foto) o nada (la casa elige sola la cámara del sensor). En Llegadas (fface) es ui.foto true / false.
- Si el aviso es por un auto, una persona, el timbre o movimiento, ponele foto: elegí la cámara que mira ese lugar (la que tiene ese sensor, la del mismo ambiente o la que lo dice en el nombre). Si hay varias posibles, preguntá cuál; si hay una sola, no preguntes. Si la persona no quiere foto, "no". Para avisos sin cámara que sirva (pilas, agua, recordatorios) no pongas nada.
- Al proponer, decí si va con foto y de qué cámara (lo que devuelve proponer en «foto»).

Llegadas y cámaras:
- «Avisame cuando llegue alguien en auto»: proponé una regla kind fface (Llegadas) con ui.phones true (la cámara ve un auto y el celular de alguien de la familia llega a casa → «Llegó Sofi en auto»), ui.cameras con la cámara de la entrada (catalogo_reglas → camaras_frigate) y, si quiere, ui.unknown_cars true para avisar autos que no reconoce. También sirve para caras (ui.people) y patentes (ui.plates «AB123CD = Auto de Juan»). Matte nunca arma aperturas automáticas: si quiere abrir, va ui.unlock con el botón del aviso (es delicado: se confirma en la app).
- «¿A qué hora llegó Sofi?», «¿cuántas veces se abrió el portón hoy?», «¿cuándo fue la última vez que hubo movimiento?»: historial.

Acomodar la casa (cuando te lo piden o cuando algo no te deja responder bien):
- revisar_casa devuelve lo que falta o anda mal (personas sin celular, celulares sin persona, ambientes sin sensor de movimiento, equipos sin ambiente o con nombres poco claros, equipos que no responden, pilas bajas, cámaras sin Frigate). Contalo de a UNA cosa, empezando por lo que más ayuda, y proponé el arreglo: renombrar un equipo (accion renombrar con entity_id y nuevo_nombre: nombres claros en castellano, «Luz techo living»), ponerle ambiente (accion ambiente con entity_id y area_id), o explicá qué conviene comprar o qué tiene que hacer el instalador (vincular un celular a una persona, sumar un sensor).

Rutina (etapa 3):
- estudiar_rutina mira el historial de las últimas semanas: lo que más se usa, lo que se repite casi todos los días a la misma hora (sugerencias, ya agrupadas) y a qué hora llega o se va cada uno. Usalo cuando pregunten «¿qué ideas tenés?», «¿qué podemos automatizar?», o cuando te pidan ordenar el inicio.
- Contá UNA o DOS ideas por vez, las más útiles, en palabras simples («Casi todas las noches a eso de las 23:30 apagás el living y la cocina: ¿querés que lo haga sola, o un botón “Buenas noches”?»). Según lo que elija, proponer una regla auto (disparador time con days) o una scene. Nunca sugieras lo que ya rechazó ni lo que ya está automatizado.
- «Armame un inicio con lo que más uso» (o si te parece útil y lo acepta): proponer con accion dashboard y equipos (los entity_id más usados, hasta 8). Matte le arma su propio inicio con «Lo que más usás» arriba; el anterior queda guardado.

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
    {"name": "historial", "description": "Qué pasó con un equipo, sensor o persona en las últimas horas (cuándo cambió y a qué estado).",
     "input_schema": {"type": "object", "required": ["entity_id"], "properties": {"entity_id": {"type": "string"}, "horas": {"type": "integer", "description": "cuántas horas para atrás (1 a 168, por defecto 24)"}}}},
    {"name": "estudiar_rutina", "description": "Estudia el historial de la casa: lo más usado, lo que se repite a la misma hora (sugerencias agrupadas) y llegadas/salidas de cada persona.",
     "input_schema": {"type": "object", "properties": {"dias": {"type": "integer", "description": "cuántos días para atrás (7 a 30, por defecto 14)"}}}},
    {"name": "revisar_casa", "description": "Revisa qué le falta o anda mal a la casa para que Matte la entienda mejor (para «acomodemos la casa»).", "input_schema": {"type": "object", "properties": {}}},
    {"name": "proponer", "description": "Propone crear, cambiar, pausar, activar o borrar una automatización, escena o recordatorio, o renombrar un equipo o ponerle ambiente. NO lo aplica: queda esperando el «dale» de la persona.",
     "input_schema": {"type": "object", "required": ["accion", "titulo", "explicacion"], "properties": {
         "accion": {"type": "string", "enum": ["crear", "cambiar", "pausar", "activar", "borrar", "renombrar", "ambiente", "dashboard"]},
         "equipos": {"type": "array", "items": {"type": "string"}, "description": "para dashboard: los entity_id de «Lo que más usás» (hasta 8)"},
         "entity_id": {"type": "string", "description": "para renombrar o ponerle ambiente"},
         "nuevo_nombre": {"type": "string", "description": "para renombrar"},
         "area_id": {"type": "string", "description": "para ponerle ambiente (de catalogo_reglas → ambientes)"},
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
            "camaras": self._camaras(),
            "camaras_frigate": self._frigate_info(),
        }

    def _camaras(self) -> list[dict[str, Any]]:
        from homeassistant.helpers import area_registry as ar  # noqa: PLC0415

        from ..avisos import area_de, camara_de  # noqa: PLC0415

        areas, out = ar.async_get(self.hass), []
        de: dict[str, list[str]] = {}
        for st in self.hass.states.async_all(("binary_sensor", "sensor", "event")):
            cam = camara_de(self.hass, st.entity_id)
            if cam:
                de.setdefault(cam, []).append(st.entity_id)
        for st in self.hass.states.async_all("camera"):
            area = areas.async_get_area(area_de(self.hass, st.entity_id) or "")
            out.append({"id": st.entity_id, "nombre": st.attributes.get("friendly_name") or st.entity_id, "ambiente": area.name if area else None,
                        "sensores": de.get(st.entity_id, [])[:12]})
        return out[:40]

    def _elegir_foto(self, raw: dict[str, Any]) -> str | None:
        """La cámara de los avisos de una regla: la que pidió Matte o, si no dijo nada, la del sensor que dispara.
        Devuelve cómo contarlo (None = la regla no avisa nada)."""
        from ..avisos import elegir_camara  # noqa: PLC0415

        ui = raw.get("ui") if isinstance(raw.get("ui"), dict) else {}
        if raw.get("kind") == "fface":
            return "sin foto" if ui.get("foto") is False or ui.get("notify") is False else "con la foto de la cámara que lo vio"
        avisos = [a for a in ui.get("actions") or [] if isinstance(a, dict) and a.get("type") == "notify"]
        if not avisos:
            return None
        sens = [t["entity"] for t in ui.get("triggers") or [] if isinstance(t, dict) and isinstance(t.get("entity"), str)]
        auto, dicho = elegir_camara(self.hass, sens), "sin foto (no hay una cámara clara para ese sensor: si hay varias, preguntá cuál)"
        for a in avisos:
            if a.get("foto") in (None, "", True) and auto:
                a["foto"] = auto
            elif a.get("foto") is False:
                a["foto"] = "no"
            elif a.get("foto") is True:
                a.pop("foto")
            foto = a.get("foto")
            if foto == "no":
                dicho = "sin foto, como pidió"
            elif foto:
                st = self.hass.states.get(str(foto))
                if st is None:
                    raise ReglaError("Esa cámara no existe (mirá catalogo_reglas → camaras).")
                dicho = f"con foto de «{st.attributes.get('friendly_name') or foto}»"
        return dicho

    def _frigate_info(self) -> dict[str, Any]:
        hub = getattr(self.hass.data.get(ESCENAS), "frigate", None)
        if hub is None:
            return {"hay": False}
        i = hub.info()
        return {"hay": True, "conectado": i.get("connected"), "camaras": i.get("cameras"), "zonas": i.get("zones"), "caras": i.get("faces"), "patentes": i.get("plates")}

    async def _t_historial(self, ctx, args):
        from datetime import timedelta  # noqa: PLC0415

        from ..selection import is_allowed  # noqa: PLC0415

        eid = str(args.get("entity_id") or "")
        st = self.hass.states.get(eid)
        if st is None or (not eid.startswith(("person.", "zone.")) and not is_allowed(self.hass, eid)):
            return {"ok": False, "error": "No encuentro ese equipo."}
        if "recorder" not in self.hass.config.components:
            return {"ok": False, "error": "Esta casa no guarda historial."}
        from homeassistant.components.recorder import get_instance, history  # noqa: PLC0415

        horas = max(1, min(168, int(args.get("horas") or 24)))
        start = dt_util.utcnow() - timedelta(hours=horas)

        def _q():
            return history.state_changes_during_period(self.hass, start, entity_id=eid, include_start_time_state=False, no_attributes=True)

        res = await get_instance(self.hass).async_add_executor_job(_q)
        cambios = []
        for x in (res or {}).get(eid, [])[-60:]:
            t = dt_util.as_local(x.last_changed)
            cambios.append(f"{DIAS[t.weekday()][:3]} {t.day}/{t.month} {t.hour:02d}:{t.minute:02d} → {x.state}")
        return {"equipo": st.attributes.get("friendly_name") or eid, "ahora": st.state, "ultimas_horas": horas, "cambios": cambios,
                "nota": "Sin cambios en ese período." if not cambios else ""}

    async def _t_revisar_casa(self, ctx, args):
        from datetime import timedelta  # noqa: PLC0415

        from homeassistant.helpers import area_registry as ar  # noqa: PLC0415
        from homeassistant.helpers import device_registry as dr  # noqa: PLC0415
        from homeassistant.helpers import entity_registry as er  # noqa: PLC0415

        from ..escenas.notify import APP_ID  # noqa: PLC0415
        from ..selection import is_allowed  # noqa: PLC0415

        S, ent_reg, dev_reg, area_reg = self.hass.states, er.async_get(self.hass), dr.async_get(self.hass), ar.async_get(self.hass)
        out: list[dict[str, Any]] = []

        def add(tipo, que, sugerencia, items=None):
            out.append({"tipo": tipo, "que": que, "sugerencia": sugerencia, **({"equipos": items[:15]} if items else {})})

        personas = S.async_all("person")
        sin_cel = [p.attributes.get("friendly_name") or p.entity_id for p in personas if not p.attributes.get("device_trackers")]
        if not personas:
            add("personas", "No hay personas cargadas: Matte no puede saber quién está en casa.", "Que el instalador cree una persona por integrante y le vincule su celular con la app MatterAI.")
        elif sin_cel:
            add("personas", f"Sin celular vinculado: {', '.join(sin_cel)}.", "Que el instalador les vincule el celular (con la app MatterAI instalada) para saber cuándo llegan y se van.")
        con_persona = {p.attributes.get("user_id") for p in personas}
        sueltos = [e.data.get("device_name") or "un celular" for e in self.hass.config_entries.async_entries("mobile_app")
                   if e.data.get("app_id") == APP_ID and e.data.get("user_id") not in con_persona]
        if sueltos:
            add("celulares", f"Celulares con la app que no están vinculados a ninguna persona: {', '.join(sueltos)}.", "Que el instalador los asigne a la persona que corresponde.")

        def area_of(entry):
            if entry.area_id:
                return entry.area_id
            dev = dev_reg.async_get(entry.device_id) if entry.device_id else None
            return dev.area_id if dev else None

        motion_areas: set[str] = set()
        light_areas: set[str] = set()
        sin_area: list[str] = []
        feos: list[dict[str, str]] = []
        for entry in list(ent_reg.entities.values()):
            st = S.get(entry.entity_id)
            if st is None or entry.disabled or entry.hidden or entry.entity_category or not is_allowed(self.hass, entry.entity_id):
                continue
            aid = area_of(entry)
            if st.domain == "binary_sensor" and st.attributes.get("device_class") in ("motion", "occupancy", "presence") and aid:
                motion_areas.add(aid)
            if st.domain in ("light", "switch", "cover", "climate", "media_player", "lock", "binary_sensor", "camera"):
                if aid and st.domain == "light":
                    light_areas.add(aid)
                if not aid:
                    sin_area.append(entry.entity_id)
                name = str(st.attributes.get("friendly_name") or "")
                if (not name or "_" in name or "0x" in name.lower() or name.lower() == entry.entity_id.split(".")[1].replace("_", " ")
                        or any(w in name for w in ("Light", "Switch", "Occupancy", "Motion", "Contact"))):
                    feos.append({"id": entry.entity_id, "nombre": name})
        sin_mov = sorted(area_reg.async_get_area(a).name for a in light_areas if a not in motion_areas and area_reg.async_get_area(a))
        if sin_mov:
            add("sensores", f"Ambientes con luces pero sin sensor de movimiento: {', '.join(sin_mov)}.", "Un sensor de movimiento por ambiente deja apagar luces solas y saber si hay alguien.")
        if feos:
            add("nombres", f"{len(feos)} equipos con nombres poco claros.", "Renombrarlos en castellano (accion renombrar), de a uno, preguntando cómo le dicen en la casa.", feos)
        if sin_area:
            add("ambientes", f"{len(sin_area)} equipos sin ambiente.", "Ponerles ambiente (accion ambiente) así se pueden manejar por ambiente.", [{"id": e} for e in sin_area])
        viejo = dt_util.utcnow() - timedelta(hours=24)
        caidos = [{"id": st.entity_id, "nombre": st.attributes.get("friendly_name")} for st in S.async_all()
                  if st.state == "unavailable" and st.last_changed < viejo and is_allowed(self.hass, st.entity_id) and st.domain not in ("update", "button", "event")]
        if caidos:
            add("sin_respuesta", f"{len(caidos)} equipos no responden hace más de un día.", "Revisar si están enchufados o con pila; si no vuelven, avisarle al instalador.", caidos)
        pilas = []
        for st in S.async_all("sensor"):
            if st.attributes.get("device_class") == "battery" and is_allowed(self.hass, st.entity_id):
                try:
                    if float(st.state) < 20:
                        pilas.append({"id": st.entity_id, "nombre": st.attributes.get("friendly_name"), "pila": st.state})
                except ValueError:
                    continue
        if pilas:
            add("pilas", f"{len(pilas)} equipos con poca pila.", "Cambiarles la pila pronto.", pilas)
        fr = self._frigate_info()
        if S.async_entity_ids("camera") and not (fr.get("hay") and fr.get("conectado")):
            add("camaras", "Hay cámaras pero no llegan detecciones de Frigate.", "Sin Frigate no se puede avisar quién llegó en auto ni detectar personas. Lo configura el instalador.")
        manager = self.hass.data.get(ESCENAS)
        if fr.get("conectado") and manager and not any(r.get("kind") == "fface" and (r.get("ui") or {}).get("phones") for r in manager.rules.values()):
            add("llegadas", "Las cámaras andan, pero no hay aviso de quién llega en auto.", "Proponé una regla de llegadas por el celular (kind fface, ui.phones true) con la cámara de la entrada.")
        return {"pendientes": out, "nota": "Todo en orden." if not out else "Contalo de a una cosa, empezando por la primera."}

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
        if accion in ("renombrar", "ambiente"):
            return self._proponer_equipo(ctx, args)
        if accion == "dashboard":
            return self._proponer_dashboard(ctx, args)
        foto: str | None = None
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
                new_ui = raw.get("ui") if isinstance(raw.get("ui"), dict) else {}
                raw = {"icon": prev.get("icon"), "color": prev.get("color"), "kind": prev.get("kind"), "name": prev.get("name"), "enabled": prev.get("enabled", True), **raw, "id": prev["id"]}
                raw["ui"] = {**(prev.get("ui") or {}), **new_ui}  # lo que Matte no menciona queda como estaba
            raw.setdefault("name", args.get("titulo"))
            if raw.get("kind") in ("reminder", "fface"):
                ui = raw.setdefault("ui", {})
                if not ui.get("recipients"):
                    ui["recipients"] = self._mis_celulares(ctx["uid"])  # el aviso le llega a quien lo pidió
            foto = self._elegir_foto(raw)
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
        return {"propuesta_id": pid, "sensible": p["sensible"], **({"foto": foto} if foto else {}), "siguiente": "Contale la propuesta en simple y preguntá si le da el «dale». No la apliques en este turno."}

    def _proponer_equipo(self, ctx, args) -> dict[str, Any]:
        from homeassistant.helpers import area_registry as ar  # noqa: PLC0415
        from homeassistant.helpers import entity_registry as er  # noqa: PLC0415

        from ..alta.core import puede_agregar  # noqa: PLC0415

        if ctx["user"] is None or not puede_agregar(self.hass, ctx["user"]):
            return {"ok": False, "error": "Los nombres y ambientes de los equipos los cambia el titular de la casa (desde la app) o el instalador."}
        eid = str(args.get("entity_id") or "")
        ent = er.async_get(self.hass).async_get(eid)
        if ent is None:
            return {"ok": False, "error": "Ese equipo no se puede cambiar desde acá (pedíselo al instalador)."}
        if args["accion"] == "renombrar":
            nuevo = " ".join(str(args.get("nuevo_nombre") or "").split())[:60]
            if len(nuevo) < 2:
                return {"ok": False, "error": "Falta el nombre nuevo."}
            extra: dict[str, Any] = {"nuevo_nombre": nuevo}
        else:
            area = ar.async_get(self.hass).async_get_area(str(args.get("area_id") or ""))
            if area is None:
                return {"ok": False, "error": "Ese ambiente no existe (mirá catalogo_reglas → ambientes)."}
            extra = {"area_id": area.id, "area": area.name}
        s = ctx["s"]
        pid = secrets.token_hex(3)
        s["propuestas"][pid] = {"id": pid, "accion": args["accion"], "titulo": str(args.get("titulo") or "")[:80], "explicacion": str(args.get("explicacion") or "")[:400],
                                "rule_id": None, "regla": None, "entity_id": eid, **extra, "turno": s["turno"], "estado": "pendiente", "sensible": False}
        ctx["nuevas"].append(pid)
        return {"propuesta_id": pid, "siguiente": "Contale el cambio y preguntá si le da el «dale». No lo apliques en este turno."}

    def _aplicar_equipo(self, user, p: dict[str, Any]) -> dict[str, Any]:
        from homeassistant.helpers import device_registry as dr  # noqa: PLC0415
        from homeassistant.helpers import entity_registry as er  # noqa: PLC0415

        from ..alta.core import puede_agregar  # noqa: PLC0415
        from ..audit import log as audit_log  # noqa: PLC0415

        if user is None or not puede_agregar(self.hass, user):
            return {"ok": False, "error": "Los nombres y ambientes los cambia el titular de la casa o el instalador."}
        reg = er.async_get(self.hass)
        ent = reg.async_get(p["entity_id"])
        if ent is None:
            return {"ok": False, "error": "Ese equipo ya no está."}
        if p["accion"] == "renombrar":
            reg.async_update_entity(ent.entity_id, name=p["nuevo_nombre"])
            say = f"Listo, ahora se llama «{p['nuevo_nombre']}»."
        else:
            if ent.device_id:
                dr.async_get(self.hass).async_update_device(ent.device_id, area_id=p["area_id"])
            else:
                reg.async_update_entity(ent.entity_id, area_id=p["area_id"])
            say = f"Listo, quedó en {p['area']}."
        p["estado"] = "hecha"
        try:
            audit_log(self.hass, "matte", "equipo renombrado" if p["accion"] == "renombrar" else "ambiente asignado", p["entity_id"],
                      f"Matte · {getattr(user, 'name', '')}", p.get("nuevo_nombre") or p.get("area") or "")
        except Exception:  # noqa: BLE001 - la auditoría nunca frena el cambio
            pass
        return {"ok": True, "say": say}

    # ------------------------------------------------------------ rutina y dashboard
    def _reglas_con_horario(self) -> list[dict[str, Any]]:
        manager = self.hass.data.get(ESCENAS)
        out: list[dict[str, Any]] = []
        for r in (manager.rules.values() if manager else []):
            if not r.get("enabled", True):
                continue
            ui = r.get("ui") or {}
            ents: set[str] = set()

            def walk(n):
                if isinstance(n, dict):
                    for k, v in n.items():
                        if k in ("entity_id", "entity", "entities") and isinstance(v, (str, list)):
                            ents.update([v] if isinstance(v, str) else [x for x in v if isinstance(x, str)])
                        else:
                            walk(v)
                elif isinstance(n, list):
                    for v in n:
                        walk(v)

            walk([r.get("actions"), ui.get("actions"), ui.get("entities")])
            horas = [str(t.get("at"))[:5] for t in r.get("triggers") or [] if isinstance(t, dict) and (t.get("platform") or t.get("trigger")) == "time" and t.get("at")]
            for h in horas:
                out.append({"nombre": r.get("name"), "hora": h, "equipos": sorted(ents)})
        return out

    async def rutina(self, dias: int = 14) -> dict[str, Any]:
        from .rutina import estudiar  # noqa: PLC0415

        if "recorder" not in self.hass.config.components:
            return {"ok": False, "error": "Esta casa no guarda historial: no se puede estudiar la rutina."}
        rooms = self._rooms()
        nombres = {e["id"]: e["nombre"] for r in rooms for e in r["equipos"]}
        ents = [e for e in nombres if e.split(".")[0] in ("light", "switch", "fan", "cover", "climate", "media_player", "input_boolean", "scene", "script")]
        for st in self.hass.states.async_all("person"):
            ents.append(st.entity_id)
            nombres[st.entity_id] = st.attributes.get("friendly_name") or st.entity_id
        return await estudiar(self.hass, max(7, min(30, int(dias or 14))), ents[:120], nombres, self._reglas_con_horario())

    async def _t_estudiar_rutina(self, ctx, args):
        return await self.rutina(int(args.get("dias") or 14))

    def _proponer_dashboard(self, ctx, args) -> dict[str, Any]:
        if ctx["user"] is None:
            return {"ok": False, "error": "El inicio de cada persona se arma desde su app: pedímelo desde «Hablar con Matte»."}
        equipos = [e for e in dict.fromkeys(args.get("equipos") or []) if isinstance(e, str) and e in ctx["allowed"]][:8]
        if len(equipos) < 2:
            return {"ok": False, "error": "Necesito al menos dos equipos del catálogo para armar «Lo que más usás»."}
        s = ctx["s"]
        pid = secrets.token_hex(3)
        s["propuestas"][pid] = {"id": pid, "accion": "dashboard", "titulo": str(args.get("titulo") or "Tu inicio")[:80], "explicacion": str(args.get("explicacion") or "")[:400],
                                "rule_id": None, "regla": None, "equipos": equipos, "turno": s["turno"], "estado": "pendiente", "sensible": False}
        ctx["nuevas"].append(pid)
        return {"propuesta_id": pid, "siguiente": "Contale cómo va a quedar su inicio y preguntá si le da el «dale». No lo apliques en este turno."}

    def _aplicar_dashboard(self, user, p: dict[str, Any]) -> dict[str, Any]:
        import voluptuous as vol  # noqa: PLC0415

        from ..views import DESIGN_KEYS, VIEW_SCHEMA, _notify, _user_devices  # noqa: PLC0415

        rt = self.hass.data.get(DOMAIN) or {}
        v = rt.get("views")
        if v is None or user is None:
            return {"ok": False, "error": "Los dashboards no están andando en esta casa."}
        devs = _user_devices(self.hass, {user.id})
        cur = next((v.views[v.assign[d]] for d in devs if v.assign.get(d) in v.views), None) or v.views.get(v.users.get(user.id) or "") or v.views.get(v.default or "")
        bloque = {"id": "matte-usados", "type": "buttons", "title": "Lo que más usás", "cfg": {"style": "devices", "cols": 2, "items": [{"entity": e} for e in p["equipos"]]}}

        def meter(blocks: list | None) -> list:
            blocks = [b for b in (blocks or []) if b.get("id") != "matte-usados"]
            if not blocks:
                return [{"id": "matte-kpis", "type": "kpis", "cfg": {"auto": True}}, bloque,
                        {"id": "matte-escenas", "type": "scenes", "cfg": {"auto": True}}, {"id": "matte-ambientes", "type": "rooms", "cfg": {"auto": True}}]
            first = blocks[0]
            b = {**bloque, **{k: first[k] for k in ("sec", "col") if first.get(k) is not None}}
            return [first, b, *blocks[1:]]

        base = {k: cur[k] for k in DESIGN_KEYS if cur and k in cur} if cur else {"kind": "phone"}
        base["blocks"] = meter(base.get("blocks"))
        if isinstance(base.get("layouts"), dict):
            base["layouts"] = {k: ({**lay, "blocks": meter(lay.get("blocks"))} if isinstance(lay, dict) and lay.get("blocks") else lay) for k, lay in base["layouts"].items()}
        propio = cur is not None and v.users.get(user.id) == cur.get("id")
        base["name"] = (cur.get("name") if propio else f"Inicio de {user.name}")[:40]
        if propio:
            base["id"] = cur["id"]  # su propio inicio: se actualiza (la versión anterior queda en el historial)
        try:
            clean = VIEW_SCHEMA(base)
        except vol.Invalid as err:
            return {"ok": False, "error": f"No pude armar el inicio: {err}"}
        view = v.put(clean, by=f"Matte · {user.name}")
        if not propio:
            v.set_user(user.id, view["id"])
            for d in devs:
                v.set_assign(d, view["id"])
        _notify(self.hass, devs)
        p["estado"] = "hecha"
        return {"ok": True, "say": "Listo, tu inicio ya tiene «Lo que más usás» arriba de todo." + ("" if propio else " El anterior quedó guardado: tu instalador lo puede volver a poner.")}

    # ------------------------------------------------------------ ideas de la semana
    def start_weekly(self):
        """Los domingos a las 19: si la rutina muestra algo nuevo para automatizar, Matte avisa (una vez por idea)."""
        from homeassistant.helpers.event import async_track_time_change  # noqa: PLC0415

        async def _tick(now) -> None:
            if dt_util.as_local(now).weekday() == 6:
                await self.ideas_de_la_semana()

        return async_track_time_change(self.hass, _tick, hour=19, minute=0, second=0)

    async def ideas_de_la_semana(self) -> dict[str, Any] | None:
        from ..escenas.notify import app_targets  # noqa: PLC0415

        if not self.disponible:
            return None
        try:
            r = await self.rutina(14)
        except Exception:  # noqa: BLE001 - sin historial no hay ideas
            _LOGGER.debug("Matte: no se pudo estudiar la rutina", exc_info=True)
            return None
        if r.get("ok") is False:
            return None
        vistas = set(self.memoria.data.setdefault("ideas_avisadas", []))
        rech = " ".join(self.memoria.rechazos(None)).lower()
        nuevas = [g for g in r.get("sugerencias") or [] if g["frase"] not in vistas and g["constancia"] >= 0.6 and g["frase"].lower() not in rech]
        if not nuevas:
            return None
        g = nuevas[0]
        self.memoria.data["ideas_avisadas"] = [*vistas, *(x["frase"] for x in nuevas)][-100:]
        self.memoria._save()  # noqa: SLF001
        msg = f"{g['frase']}. ¿Querés que lo haga sola la casa? Tocá para verlo con Matte."
        for target in app_targets(self.hass):
            try:
                await self.hass.services.async_call("notify", target, {"title": "💡 Una idea para tu casa", "message": msg,
                                                                       "data": {"url": "/?matte=ideas", "tag": "matterai-matte-ideas"}}, blocking=False)
            except Exception:  # noqa: BLE001 - un aviso que no sale no rompe nada
                _LOGGER.debug("Matte: no salió el aviso a %s", target, exc_info=True)
        return g

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

        if p["accion"] in ("renombrar", "ambiente"):
            return self._aplicar_equipo(user, p)
        if p["accion"] == "dashboard":
            return self._aplicar_dashboard(user, p)
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
