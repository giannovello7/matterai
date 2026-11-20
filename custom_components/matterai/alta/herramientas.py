"""Las herramientas del alta: las mismas para Matte (tool use) y para el asistente en pantallas (WebSocket).

`ejecutar(hass, user, nombre, args)` valida permisos y argumentos, llama a la herramienta y devuelve un dict.
Los errores para el cliente salen como {"ok": False, "error": "..."} (nunca una excepción hacia la IA).
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

from homeassistant.core import HomeAssistant

from ..const import DOMAIN
from .core import DEFAULT_UNION, MAX_ESPERA, MAX_UNION, Alta, AltaError, puede_agregar, quien

SIN_PERMISO = "Agregar equipos lo puede hacer sólo el titular de la casa o el instalador."

Handler = Callable[[HomeAssistant, Alta, Any, dict[str, Any]], Awaitable[dict[str, Any]]]
TOOLS: dict[str, dict[str, Any]] = {}


def tool(name: str, description: str, props: dict[str, Any] | None = None, required: list[str] | None = None):
    def deco(fn: Handler) -> Handler:
        TOOLS[name] = {"fn": fn, "schema": {
            "name": name,
            "description": description,
            "input_schema": {"type": "object", "properties": props or {}, "required": required or [], "additionalProperties": False},
        }}
        return fn
    return deco


def alta(hass: HomeAssistant) -> Alta | None:
    return (hass.data.get(DOMAIN) or {}).get("alta")


def _device_id(args: dict[str, Any]) -> str:
    d = args.get("device_id")
    if not isinstance(d, str) or not d or len(d) > 64:
        raise AltaError("Falta el equipo.")
    return d


# ---------------------------------------------------------------- Zigbee
@tool("detectar_coordinador", "Qué coordinador Zigbee tiene la casa: Zigbee2MQTT, ZHA, ambos o ninguno.")
async def _detectar(hass, a: Alta, user, args):
    return a.detectar_coordinador()


@tool("habilitar_union", f"Abre la unión por un tiempo (máximo {MAX_UNION} s, por defecto {DEFAULT_UNION}) en Zigbee, Z-Wave o las dos. Se cierra sola al vencer.",
      {"segundos": {"type": "integer", "description": f"1 a {MAX_UNION}"},
       "red": {"type": "string", "enum": ["zigbee", "zwave", "todas"], "description": "por defecto todas"}})
async def _habilitar(hass, a: Alta, user, args):
    red = args.get("red") or "todas"
    if red not in ("zigbee", "zwave", "todas"):
        raise AltaError("La red es zigbee, zwave o todas.")
    return await a.habilitar_union(args.get("segundos") or DEFAULT_UNION, await quien(hass, user), red)


@tool("deshabilitar_union", "Cierra la unión Zigbee.")
async def _deshabilitar(hass, a: Alta, user, args):
    return await a.deshabilitar_union(await quien(hass, user), "cerrada a mano")


@tool("esperar_dispositivo_nuevo", "Espera a que aparezca un equipo nuevo (Zigbee, Matter o WiFi) y devuelve qué es.",
      {"timeout": {"type": "integer", "description": f"segundos, 1 a {MAX_ESPERA}"}})
async def _esperar(hass, a: Alta, user, args):
    return await a.esperar_dispositivo_nuevo(args.get("timeout") or 120)


@tool("capacidades", "Qué es un equipo: tipo, marca, modelo y todas sus funciones.", {"device_id": {"type": "string"}}, ["device_id"])
async def _capacidades(hass, a: Alta, user, args):
    info = a.info(_device_id(args))
    if info is None:
        raise AltaError("No encuentro ese equipo.")
    return info


@tool("quitar_dispositivo", "Saca de la casa un equipo que se unió y el cliente no reconoce (sólo con su confirmación).",
      {"device_id": {"type": "string"}}, ["device_id"])
async def _quitar(hass, a: Alta, user, args):
    return await a.quitar(_device_id(args), await quien(hass, user))


# ---------------------------------------------------------------- Z-Wave
@tool("pin_zwave", "Cuando el equipo Z-Wave pide su PIN de seguridad (estado pide_pin): los 5 primeros números del código DSK impreso en el equipo o la caja.",
      {"pin": {"type": "string"}}, ["pin"])
async def _pin_zwave(hass, a: Alta, user, args):
    await a.zwave.pin(str(args.get("pin") or ""))
    return {"mensaje": "PIN aceptado. Ahora llamá a esperar_dispositivo_nuevo."}


@tool("qr_zwave", "Anota un equipo Z-Wave con su QR SmartStart (número largo que empieza con 90): se une solo apenas se le pone corriente.",
      {"codigo": {"type": "string"}}, ["codigo"])
async def _qr_zwave(hass, a: Alta, user, args):
    if not a.desde:
        a.iniciar()
    await a.zwave.qr(str(args.get("codigo") or ""))
    a._audit("equipo Z-Wave anotado con QR", "", await quien(hass, user))  # noqa: SLF001
    return {"mensaje": "Listo. Que le ponga corriente (o la pila) al equipo; después llamá a esperar_dispositivo_nuevo."}


@tool("excluir_zwave", "Saca un equipo Z-Wave de la red en la que estaba (hace falta si estuvo en otra casa o no se une). El cliente aprieta el botón del equipo como para agregarlo.",
      {"segundos": {"type": "integer", "description": "1 a 254, por defecto 60"}})
async def _excluir_zwave(hass, a: Alta, user, args):
    n = max(1, min(MAX_UNION, int(args.get("segundos") or 60)))
    out = await a.zwave.excluir(n)
    if out["excluido"]:
        a._audit("equipo Z-Wave excluido", "", await quien(hass, user))  # noqa: SLF001
    return out


# ---------------------------------------------------------------- área y nombre
@tool("listar_areas", "Los ambientes (áreas) de la casa, con su piso si hay pisos.")
async def _areas(hass, a: Alta, user, args):
    return {"areas": a.listar_areas()}


@tool("asignar_area", "Pone el equipo en un ambiente. Usá area_id de listar_areas; si el ambiente no existe, area_nueva con su nombre.",
      {"device_id": {"type": "string"}, "area_id": {"type": "string"}, "area_nueva": {"type": "string"}}, ["device_id"])
async def _asignar(hass, a: Alta, user, args):
    return await a.asignar_area(_device_id(args), args.get("area_id"), args.get("area_nueva"), await quien(hass, user))


@tool("renombrar", "Le pone al equipo un nombre en castellano (por ejemplo «Sensor puerta Cocina») y ordena los de sus entidades.",
      {"device_id": {"type": "string"}, "nombre": {"type": "string"}}, ["device_id", "nombre"])
async def _renombrar(hass, a: Alta, user, args):
    return await a.renombrar(_device_id(args), str(args.get("nombre") or ""), await quien(hass, user))


# ---------------------------------------------------------------- Matter
@tool("estado_matter", "Si Matter anda en la casa y, para equipos Thread, si hay border router y red Thread preferida.")
async def _estado_matter(hass, a: Alta, user, args):
    from .matter import estado_matter  # noqa: PLC0415

    return await estado_matter(hass)


@tool("preparar_matter", "Empieza a esperar un equipo Matter que el cliente va a sumar escaneando el QR con la app. Devuelve si está todo listo.",
      {"thread": {"type": "boolean", "description": "true si el equipo es Thread"}})
async def _preparar_matter(hass, a: Alta, user, args):
    from .matter import estado_matter  # noqa: PLC0415

    est = await estado_matter(hass)
    if not est["matter"]["ok"]:
        raise AltaError(est["matter"]["mensaje"])
    if args.get("thread") and not est["thread"]["ok"]:
        raise AltaError(est["thread"]["mensaje"])
    a.iniciar()
    return {"listo": True, **est}


@tool("comisionar_matter", "Suma por la red un equipo Matter que ya está en otra app (Apple Home, Google Home, Alexa, SmartThings) con el código que generó esa app: 11 dígitos o MT:...",
      {"codigo": {"type": "string"}}, ["codigo"])
async def _comisionar(hass, a: Alta, user, args):
    from .matter import comisionar  # noqa: PLC0415

    if not a.desde:
        a.iniciar()
    out = await comisionar(hass, str(args.get("codigo") or ""))
    a._audit("equipo Matter sumado por la red", "", await quien(hass, user), "código compartido desde otra app")  # noqa: SLF001
    return {**out, "mensaje": "Se sumó. Ahora llamá a esperar_dispositivo_nuevo para ver qué es."}


# ---------------------------------------------------------------- WiFi y lo que la casa encontró sola
def _desc(hass):
    d = (hass.data.get(DOMAIN) or {}).get("descubrimientos")
    if d is None:
        raise AltaError("Esta casa todavía no está buscando equipos nuevos.")
    return d


@tool("preparar_wifi", "Empieza a esperar un equipo WiFi (Shelly y otros) que el cliente va a conectar al wifi de la casa con su propia app. Devuelve lo que la casa ya encontró.")
async def _preparar_wifi(hass, a: Alta, user, args):
    a.iniciar()
    return {"descubiertos": _desc(hass).listar()}


@tool("listar_descubiertos", "Equipos que la casa encontró sola en la red (Shelly, Chromecast…) o que entraron sin ambiente.")
async def _listar_desc(hass, a: Alta, user, args):
    return {"descubiertos": _desc(hass).listar()}


@tool("agregar_descubierto", "Agrega un equipo de listar_descubiertos (por su id). Si contesta pide_datos, pedile al cliente esos campos y volvé a llamar con datos. Después llamá a esperar_dispositivo_nuevo.",
      {"id": {"type": "string"}, "datos": {"type": "object", "description": "nombre del campo → valor (sólo si lo pidió)"}}, ["id"])
async def _agregar_desc(hass, a: Alta, user, args):
    if not a.desde:
        a.iniciar()
    datos = args.get("datos") or None
    if datos is not None and not isinstance(datos, dict):
        raise AltaError("Los datos vinieron mal.")
    out = await _desc(hass).agregar(str(args.get("id") or ""), await quien(hass, user), datos)
    if out.get("device_id"):  # ya estaba en la casa (sin ambiente): sigue directo
        info = a.info(out["device_id"])
        if info:
            a.sesion.append(out["device_id"])
            return {**out, **info, "encontrado": True}
    return out


@tool("ignorar_descubierto", "Ignora un equipo de listar_descubiertos para que no vuelva a aparecer (sólo si el cliente lo pide).", {"id": {"type": "string"}}, ["id"])
async def _ignorar_desc(hass, a: Alta, user, args):
    return await _desc(hass).ignorar(str(args.get("id") or ""), await quien(hass, user))


@tool("mas_tarde_descubierto", "Deja un equipo de listar_descubiertos para más tarde.", {"id": {"type": "string"}}, ["id"])
async def _luego_desc(hass, a: Alta, user, args):
    return _desc(hass).mas_tarde(str(args.get("id") or ""))


# ---------------------------------------------------------------- automatizaciones (siempre desde plantillas)
@tool("sugerir_automatizaciones", "Las automatizaciones que tienen sentido para este equipo (plantillas con sus parámetros y valores por defecto).",
      {"device_id": {"type": "string"}}, ["device_id"])
async def _sugerir(hass, a: Alta, user, args):
    from .plantillas import sugerir  # noqa: PLC0415

    info = a.info(_device_id(args))
    if info is None:
        raise AltaError("No encuentro ese equipo.")
    return {"plantillas": sugerir(hass, info)}


@tool("crear_automatizacion", "Crea una automatización desde una plantilla de sugerir_automatizaciones. SÓLO después de que el cliente dijo que sí.",
      {"device_id": {"type": "string"}, "plantilla": {"type": "string"},
       "parametros": {"type": "object", "description": "nombre → valor; los que falten van con su valor por defecto"}},
      ["device_id", "plantilla"])
async def _crear(hass, a: Alta, user, args):
    from .plantillas import crear  # noqa: PLC0415

    info = a.info(_device_id(args))
    if info is None:
        raise AltaError("No encuentro ese equipo.")
    params = args.get("parametros") or {}
    if not isinstance(params, dict):
        raise AltaError("Los parámetros vinieron mal.")
    out = await crear(hass, user, info, str(args.get("plantilla") or ""), params)
    a._audit("automatización creada", out["nombre"], await quien(hass, user), f"{info['nombre']} · {args.get('plantilla')}")  # noqa: SLF001
    return out


@tool("terminar", "Termina el alta: cierra la unión si quedó abierta y devuelve el resumen de lo agregado en esta sesión.")
async def _terminar(hass, a: Alta, user, args):
    return await a.cerrar_sesion(await quien(hass, user))


# ---------------------------------------------------------------- entrada única
async def ejecutar(hass: HomeAssistant, user, nombre: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    if not puede_agregar(hass, user):
        return {"ok": False, "error": SIN_PERMISO, "codigo": "sin_permiso"}
    a = alta(hass)
    t = TOOLS.get(nombre)
    if a is None or t is None:
        return {"ok": False, "error": "Esa herramienta no existe.", "codigo": "no_existe"}
    try:
        out = await t["fn"](hass, a, user, dict(args or {}))
    except AltaError as err:
        return {"ok": False, "error": str(err)}
    except (TypeError, ValueError):
        return {"ok": False, "error": "Faltan o sobran datos para hacer eso."}
    return {"ok": True, **out} if "ok" not in out else out
