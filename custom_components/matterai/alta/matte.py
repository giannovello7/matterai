"""Matte conversa para agregar equipos: la IA decide qué herramienta usar y la integración las ejecuta y valida.

- Mismo modelo y clave que la voz (voice.py). Sin clave de IA, la app abre el asistente en pantallas.
- Cada sesión guarda su conversación en memoria (nunca en disco ni en logs) y vence a los 20 minutos sin uso.
- El código de vinculación Matter se borra de la conversación apenas se usa.
- Las automatizaciones se crean sólo si se propusieron en un turno anterior (el cliente tuvo que contestar).
"""

from __future__ import annotations

import json
import logging
import re
import secrets
import time
from typing import Any

from homeassistant.core import HomeAssistant

from ..const import CONF_AI_KEY, DOMAIN
from ..voice import FALLBACK_BETA, MODEL
from .core import puede_agregar
from .herramientas import SIN_PERMISO, TOOLS, alta, ejecutar

_LOGGER = logging.getLogger(__name__)

SESION_VENCE = 20 * 60
MAX_RONDAS = 12
MAX_MENSAJES = 120
OCULTAR = {"comisionar_matter": ("codigo",), "pin_zwave": ("pin",), "qr_zwave": ("codigo",), "agregar_descubierto": ("datos",)}  # nunca queda guardado
ESPERAR_DESPUES = {"habilitar_union", "preparar_wifi", "preparar_matter"}  # la app espera el equipo sola

SYSTEM = """Sos Matte, el asistente de MatterAI. Ahora estás ayudando al dueño de casa a agregar equipos nuevos.
Hablás en castellano rioplatense, con voseo, cálido y simple. Mensajes MUY cortos (una a tres oraciones), un paso por vez, sin jerga técnica: nunca digas Zigbee2MQTT, ZHA, MQTT, entity_id, IEEE ni ids. Para el cliente es «el equipo».

Cómo lo guiás:
1. Si no dijo qué va a agregar, preguntá qué es o cómo se conecta: Zigbee (sensores, botones, enchufes y lámparas que dicen Zigbee), Matter (tiene el logo Matter y un código QR o de 11 dígitos), o WiFi (Shelly y otros). Si no sabe, empezá por Zigbee si la casa tiene coordinador.
2. Zigbee: detectar_coordinador. Si no hay, explicá que falta el coordinador y que lo instala el instalador. Si hay: habilitar_union (180 s salvo que pidan otra cosa) y en ESE MISMO turno explicá cómo ponerlo en modo emparejamiento, en general: mantener apretado su botón unos 5 segundos hasta que titile; una lámpara: prenderla y apagarla 5 o 6 veces seguidas; si no tiene botón, sacarle la pila y volver a ponerla. Terminá ahí tu turno: la app te va a escribir «[app] esperando» y recién ahí llamás esperar_dispositivo_nuevo (timeout 120).
3. Cuando aparece: decile qué es con marca y modelo («Encontré un sensor de apertura Aqara»). Si el cliente no lo reconoce, ofrecé sacarlo y sólo si dice que sí, quitar_dispositivo. Si no apareció, ofrecé reintentar (otra vez habilitar_union) y repasá cómo resetearlo.
4. Preguntá dónde lo instaló: listar_areas y ofrecé los ambientes por su nombre. asignar_area con el que elija; si nombra uno que no existe, confirmá y usá area_nueva.
5. Proponé el nombre (nombre_sugerido, o uno mejor con lo que te contó) y renombrar cuando te diga que sí o te dé otro.
6. Automatizaciones: sugerir_automatizaciones y contale en simple las que tienen sentido (máximo 3), preguntando cuáles quiere. NUNCA crees una sin que el cliente diga que sí en su respuesta; recién ahí crear_automatizacion con la plantilla y los parámetros (usá los valores por defecto si no dijo otros). Si dice que no, seguí.
7. Preguntá si quiere agregar otro. Cuando termina: terminar y resumí en una oración lo que quedó (nombre y ambiente de cada equipo).

Matter: estado_matter primero. Si es Thread y falta el border router o la red, explicá qué falta en vez de seguir. Equipo nuevo (nunca configurado): se suma escaneando su QR con la app (botón «Escanear QR Matter» del asistente); decile que toque ese botón. Equipo que ya está en Apple Home, Google Home, Alexa o SmartThings: explicale cómo sacar un código para compartirlo desde esa app (Apple: Casa → el equipo → Ajustes → Activar modo de vinculación; Google Home: el equipo → Ajustes → Apps y servicios vinculados → Vincular app o servicio; Alexa: Dispositivos → el equipo → Otros asistentes y apps; SmartThings: el equipo → ⋮ → Compartir con otros servicios) y pedile el código de 11 dígitos o el texto MT:...; después comisionar_matter.
Z-Wave: habilitar_union con red zwave y explicá cómo ponerlo en modo agregar (en general, apretar su botón 1 o 3 veces seguidas; mirá el manual del equipo). Si el estado dice pide_pin, pedile los 5 primeros números del código DSK impreso en el equipo o la caja y llamá a pin_zwave. Si tiene QR SmartStart (número largo que empieza con 90), qr_zwave y que le ponga corriente. Si no se une, puede que esté en otra red: ofrecé excluir_zwave primero (el cliente aprieta el mismo botón) y después volvé a intentar.
Otros equipos locales (Bluetooth, ESPHome, HomeKit, Shelly y lo que la casa encuentre sola): listar_descubiertos / agregar_descubierto. Si pide datos (código de HomeKit de 8 números, clave de ESPHome, contraseña), pedíselos al cliente uno por uno y volvé a llamar a agregar_descubierto con datos.
WiFi (Shelly y otros): preparar_wifi y explicá que primero se conecta al wifi de la casa con su propia app (Shelly: app Shelly Smart Control) o desde su red propia; cuando Home Assistant lo encuentra lo agregamos (agregar_descubierto) y seguís desde el paso 3.

Equipos que la casa encontró sola: si la app te dice que el cliente tocó «Agregar» en uno (con su id), agregar_descubierto con ese id; si quedó agregado, esperar_dispositivo_nuevo y seguí desde el paso 3. Si pide datos, explicá que lo termina el instalador.

Reglas:
- Usá sólo ids que te devolvieron las herramientas. Nunca inventes.
- Si una herramienta devuelve ok false, contá el problema en simple y qué hacer.
- Si te piden algo que no es agregar equipos, decí que para eso usen el micrófono de siempre.
- Nunca repitas en voz alta un código de vinculación.
"""

_ALTA_RE = re.compile(
    r"\b(agreg|sum|añad|anad|instal|vincul|empare|conect|configur)\w*\b.*\b(dispositiv|equip|sensor|enchuf|lampar|lámpar|foco|bot[oó]n|interruptor|llave|zigbee|matter|shelly|cosa|aparat)",
    re.IGNORECASE,
)


def es_pedido_de_alta(texto: str) -> bool:
    """«Voy a agregar dispositivos nuevos», «quiero sumar un sensor»… (la voz de siempre lo deriva a Matte)."""
    return bool(_ALTA_RE.search(texto or ""))


_CODIGO_RE = re.compile(r"MT:[0-9A-Z.\-]+|(?<!\d)90\d{50,}(?!\d)|(?<!\d)\d(?:[\s\-.]?\d){10}(?:(?:[\s\-.]?\d){10})?(?!\d)", re.IGNORECASE)
_PIN_RE = re.compile(r"(?<!\d)\d{5}(?!\d)")


def _ocultar_codigos(messages: list[dict[str, Any]], pin: bool = False) -> None:
    """Después de usar un código de vinculación (o el PIN Z-Wave), no queda en la conversación (ni lo que escribió el cliente)."""
    for m in messages:
        if m["role"] == "user" and isinstance(m["content"], str):
            m["content"] = _CODIGO_RE.sub("(código oculto)", m["content"])
            if pin:
                m["content"] = _PIN_RE.sub("(PIN oculto)", m["content"])


def _dump(block: Any) -> dict[str, Any]:
    if isinstance(block, dict):
        return block
    if hasattr(block, "model_dump"):
        return block.model_dump(exclude_none=True)
    return dict(vars(block))


def api_key(hass: HomeAssistant) -> str | None:
    rt = hass.data.get(DOMAIN) or {}
    voice = rt.get("voice")
    if voice is not None and getattr(voice, "api_key", None):
        return voice.api_key
    entry = rt.get("entry")
    if entry is None:
        return None
    return {**entry.data, **entry.options}.get(CONF_AI_KEY) or None


class Conversaciones:
    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self.sesiones: dict[str, dict[str, Any]] = {}
        self._client = None
        self._client_key: str | None = None

    async def _get_client(self, key: str):
        if self._client is None or self._client_key != key:
            import anthropic  # noqa: PLC0415

            self._client = await self.hass.async_add_executor_job(lambda: anthropic.AsyncAnthropic(api_key=key, timeout=60.0, max_retries=1))
            self._client_key = key
        return self._client

    def _limpiar(self) -> None:
        now = time.time()
        for sid in [k for k, s in self.sesiones.items() if now - s["t"] > SESION_VENCE]:
            self.sesiones.pop(sid, None)

    def _sesion(self, user, session_id: str | None) -> dict[str, Any]:
        self._limpiar()
        s = self.sesiones.get(session_id or "")
        if s is None or s["user_id"] != user.id:
            session_id = secrets.token_urlsafe(12)
            s = {"id": session_id, "user_id": user.id, "messages": [], "turno": 0, "propuestas": {}, "t": time.time()}
            self.sesiones[session_id] = s
        s["t"] = time.time()
        return s

    def _contexto(self) -> str:
        a = alta(self.hass)
        if a is None:
            return ""
        snap = a.snapshot()
        u = snap["union"]
        quedan = f", quedan {max(0, int(u['hasta'] - time.time()))} s de unión abierta" if u.get("abierta") else ""
        return f"[estado: {snap['estado']}{quedan}]\n"

    async def conversar(self, user, session_id: str | None, texto: str, auto: str | None = None) -> dict[str, Any]:
        if not puede_agregar(self.hass, user):
            return {"ok": False, "say": SIN_PERMISO, "codigo": "sin_permiso"}
        key = api_key(self.hass)
        if not key:
            return {"ok": True, "sin_ia": True, "say": "Te abro el asistente para agregar equipos: es paso a paso."}
        s = self._sesion(user, session_id)
        s["turno"] += 1
        if auto == "esperar":
            texto = "[app] esperando: el cliente ya puso el equipo en modo emparejamiento. Llamá a esperar_dispositivo_nuevo."
        elif auto == "descubierto":
            texto = f"[app] el cliente tocó «Agregar» en un equipo que encontró la casa, id: {texto}".strip()
        n0 = len(s["messages"])
        s["messages"].append({"role": "user", "content": self._contexto() + (texto or "").strip()[:800]})
        try:
            client = await self._get_client(key)
        except Exception:  # noqa: BLE001
            _LOGGER.warning("Matte: no se pudo preparar la IA", exc_info=True)
            return {"ok": False, "session_id": s["id"], "say": "No me pude conectar. Probá de nuevo en un ratito."}
        usadas: list[str] = []
        siguiente = None
        fin = False
        say = ""
        try:
            for _ in range(MAX_RONDAS):
                resp = await self._llamar(client, s["messages"])
                blocks = [_dump(b) for b in resp.content]
                s["messages"].append({"role": "assistant", "content": blocks})
                uses = [b for b in blocks if b.get("type") == "tool_use"]
                say = " ".join(str(b.get("text") or "") for b in blocks if b.get("type") == "text").strip() or say
                if not uses:
                    break
                results = []
                for u in uses:
                    name, args = u.get("name"), dict(u.get("input") or {})
                    out = await self._herramienta(user, s, name, args)
                    usadas.append(name)
                    if out.get("ok") and name in ESPERAR_DESPUES:
                        siguiente = "esperar"
                    elif name == "esperar_dispositivo_nuevo":
                        siguiente = None  # ya esperó en este mismo turno
                    if out.get("ok") and name == "terminar":
                        fin = True
                    if name in OCULTAR:
                        u["input"] = {**u.get("input", {}), **{k: "(oculto)" for k in OCULTAR[name]}}
                    results.append({"type": "tool_result", "tool_use_id": u.get("id"), "content": json.dumps(out, ensure_ascii=False, default=str)[:6000]})
                s["messages"].append({"role": "user", "content": results})
            else:
                s["messages"].append({"role": "assistant", "content": [{"type": "text", "text": "…"}]})
        except Exception as err:  # noqa: BLE001 - la conversación nunca rompe la app
            _LOGGER.warning("Matte: error de la IA (%s)", type(err).__name__)
            del s["messages"][n0:]  # la conversación queda coherente: se descarta el turno a medias
            return {"ok": False, "session_id": s["id"], "say": "Tuve un problema para pensar eso. Probá de nuevo.", "estado": self._snap()}
        if {"comisionar_matter", "qr_zwave", "pin_zwave", "agregar_descubierto"} & set(usadas):
            _ocultar_codigos(s["messages"], pin="pin_zwave" in usadas)
        if len(s["messages"]) > MAX_MENSAJES:
            fin = True
        if fin:
            self.sesiones.pop(s["id"], None)
        return {"ok": True, "session_id": s["id"], "say": say or "Listo.", "estado": self._snap(), "siguiente": siguiente, "fin": fin, "herramientas": usadas}

    def _snap(self) -> dict[str, Any]:
        a = alta(self.hass)
        return a.snapshot() if a else {}

    async def _herramienta(self, user, s: dict[str, Any], name: str, args: dict[str, Any]) -> dict[str, Any]:
        if name == "crear_automatizacion":
            pid = str(args.get("propuesta") or args.get("plantilla") or "")
            dev = str(args.get("device_id") or "")
            if s["propuestas"].get(f"{dev}|{pid}", s["turno"]) >= s["turno"]:
                return {"ok": False, "error": "Primero contale la automatización al cliente y esperá que diga que sí."}
        out = await ejecutar(self.hass, user, name, args)
        if name == "sugerir_automatizaciones" and out.get("ok"):
            for p in out.get("plantillas") or []:
                s["propuestas"].setdefault(f"{args.get('device_id')}|{p.get('plantilla')}", s["turno"])
        return out

    async def _llamar(self, client, messages: list[dict[str, Any]]):
        tools = [t["schema"] for t in TOOLS.values()]
        if tools:
            tools = [*tools[:-1], {**tools[-1], "cache_control": {"type": "ephemeral"}}]
        return await client.messages.create(
            model=MODEL,
            max_tokens=1500,
            system=[{"type": "text", "text": SYSTEM, "cache_control": {"type": "ephemeral"}}],
            tools=tools,
            messages=messages,
            extra_headers={"anthropic-beta": FALLBACK_BETA},
            extra_body={"output_config": {"effort": "low"}, "fallbacks": "default"},
        )
