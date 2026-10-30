"""Intérprete de voz GRATIS (sin IA): entiende los pedidos comunes en castellano.

"prendé la luz del living", "apagá el aire del dormitorio", "poné el aire en 23",
"bajá la persiana del quincho", "luz de la cocina al 40%", "subí el volumen",
"pausá la música", "activá la escena cine", "apagá todo", "¿está prendida la luz del baño?".

Usa los mismos nombres de ambientes y equipos que ve el cliente (los del dashboard).
Devuelve acciones con el mismo formato que la IA, así pasan por la misma validación.
Si no entiende con seguridad, devuelve None (y, si hay clave, se le pregunta a la IA).
"""

from __future__ import annotations

import re
import unicodedata
from typing import Any

from homeassistant.core import HomeAssistant

# palabras de cada tipo de equipo (sin acentos)
TYPES: dict[str, tuple[str, ...]] = {
    "light": ("luz", "luces", "lampara", "lamparas", "velador", "veladores", "spot", "spots", "dicroica", "foco", "focos", "tira", "led", "arana", "aplique", "farol", "faroles", "guirnalda", "iluminacion"),
    "climate": ("aire", "aires", "acondicionado", "split", "clima", "calefaccion", "calefactor", "climatizador"),
    "fan": ("ventilador", "ventiladores", "turbo"),
    "cover": ("persiana", "persianas", "cortina", "cortinas", "toldo", "toldos", "blackout", "roller", "rollers"),
    "tv": ("tele", "tv", "televisor", "television", "smart"),
    "music": ("musica", "parlante", "parlantes", "audio", "cancion", "tema"),
    "switch": ("enchufe", "enchufes", "toma", "tomacorriente"),
}
ON = r"\b(prend|encend|encende|activ|enciend|pone|pon|da(le)? (la )?luz)"
OFF = r"\b(apag|desactiv|cort)"
OPEN = r"\b(abr|subi|sube|subir|levant)"
CLOSE = r"\b(cerr|cierr|baja|baj[ae]|bajar)"
STOP = r"\b(par[ae]|detene|deten|frena)"
GENERIC = {"luz", "luces", "la", "el", "los", "las", "de", "del", "y", "en", "aire", "tele", "tv", "persiana", "cortina", "ventilador", "parlante", "lampara"}
WORDS_ALL = ("todo", "todas", "todos", "toda", "casa")
ARTICLES = r"(?:del?|de la|de los|de las|en el|en la|en los|en las|en|el|la|los|las|al)\s+"


def norm(text: str) -> str:
    t = unicodedata.normalize("NFD", str(text or "").lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    t = re.sub(r"[¿?¡!,.;:]", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def _words(t: str) -> set[str]:
    return set(t.split())


def _has_type(t: str, kind: str) -> bool:
    w = _words(t)
    return any(k in w for k in TYPES[kind])


def _kind_of(hass: HomeAssistant, eid: str, name: str) -> str:
    d = eid.split(".")[0]
    if d == "media_player":
        st = hass.states.get(eid)
        dc = (st.attributes.get("device_class") if st else "") or ""
        n = norm(name)
        return "tv" if dc == "tv" or any(k in n.split() for k in ("tv", "tele", "televisor")) else "music"
    if d == "switch":
        return "light" if any(k in norm(name).split() for k in ("luz", "luces", "lampara", "velador", "spot", "spots", "farol", "guirnalda")) else "switch"
    return {"input_boolean": "switch"}.get(d, d)


class _Cat:
    """Catálogo de la casa (ambientes y equipos) preparado para buscar por palabras."""

    def __init__(self, hass: HomeAssistant, rooms: list[dict[str, Any]]):
        self.hass = hass
        self.rooms = []
        self.everywhere = None  # parlante (o grupo) de toda la casa
        for r in rooms:
            if r.get("todo"):
                self.everywhere = r.get("parlante")
                continue
            eqs = [{"id": e["id"], "nombre": e["nombre"], "n": norm(e["nombre"]), "kind": _kind_of(hass, e["id"], e["nombre"])} for e in r["equipos"]]
            self.rooms.append({"name": r["ambiente"], "n": norm(r["ambiente"]), "eqs": eqs, "spk": r.get("parlante")})

    def find_rooms(self, t: str) -> list[dict[str, Any]]:
        found = []
        for r in self.rooms:
            if r["n"].startswith("modos") or r["n"] in ("musica", "ajustes"):  # "poné música" no es el ambiente Música
                continue
            if re.search(r"(?:^|\s)" + re.escape(r["n"]) + r"(?:\s|$)", t):
                found.append(r)
        # "living" no debe ganarle a "living quincho" si nombraron el más largo
        found.sort(key=lambda r: -len(r["n"]))
        out = []
        for r in found:
            if not any(r["n"] in o["n"] and r is not o for o in out):
                out.append(r)
        return out

    def find_named(self, t: str, kinds: set[str] | None) -> list[dict[str, Any]]:
        """Equipos nombrados por su propio nombre ("velador", "tira led", "aire del dormitorio")."""
        hits = []
        words = _words(t)
        room_words = {w for r in self.rooms for w in r["n"].split()}
        for r in self.rooms:
            for e in r["eqs"]:
                if kinds and e["kind"] not in kinds:
                    continue
                n = e["n"]
                if len(n) >= 4 and re.search(r"(?:^|\s)" + re.escape(n) + r"(?:\s|$)", t):
                    hits.append(e)
                    continue
                # "luz de la galería" también nombra a "Luz galería": alcanza con las palabras propias del nombre,
                # salvo que sean sólo el ambiente ("Luz living" = la luz del living → todas las del ambiente)
                core = [w for w in n.split() if w not in GENERIC]
                if core and all(w in words for w in core) and not set(core) <= room_words:
                    hits.append(e)
        hits.sort(key=lambda e: -len(e["n"]))
        out: list[dict[str, Any]] = []
        for e in hits:  # si nombraron "luz principal dormitorio", no sumar también "luz principal"
            if not any(e["n"] in o["n"] for o in out):
                out.append(e)
        return out

    def all_eqs(self, rooms=None, kinds: set[str] | None = None) -> list[dict[str, Any]]:
        src = rooms if rooms is not None else self.rooms
        seen, out = set(), []
        for r in src:
            for e in r["eqs"]:
                if (kinds is None or e["kind"] in kinds) and e["id"] not in seen:
                    seen.add(e["id"])
                    out.append(e)
        return out


def _act(service: str, ids: list[str], **kw) -> dict[str, Any]:
    base = {"brightness_pct": None, "temperature": None, "hvac_mode": None, "position": None, "percentage": None, "volume_level": None, "media_query": None, "media_type": None}
    base.update(kw)
    return {"servicio": service, "entity_ids": ids, **base}


def _place(rooms: list[dict[str, Any]]) -> str:
    if not rooms:
        return ""
    names = [r["name"] for r in rooms]
    return " en " + (names[0] if len(names) == 1 else ", ".join(names[:-1]) + " y " + names[-1])


def _num(t: str, after: str) -> float | None:
    m = re.search(after, t)
    return float(m.group(1).replace(",", ".")) if m else None


def _music(hass: HomeAssistant, cat: _Cat, t: str, rms: list[dict[str, Any]], memo: dict[str, Any]) -> dict[str, Any] | None | bool:
    from .local_music import music  # noqa: PLC0415

    return music(hass, cat, t, rms, memo)


def _volume(S, ids: list[str], t: str) -> float:
    from .local_music import volume  # noqa: PLC0415

    return volume(S, ids, t)


WORD_NUMS = {"diez": 10, "quince": 15, "dieciseis": 16, "diecisiete": 17, "dieciocho": 18, "diecinueve": 19, "veinte": 20, "veintiuno": 21, "veintidos": 22,
             "veintitres": 23, "veinticuatro": 24, "veinticinco": 25, "veintiseis": 26, "veintisiete": 27, "veintiocho": 28, "treinta": 30, "cincuenta": 50, "cien": 100}


def interpret(hass: HomeAssistant, rooms: list[dict[str, Any]], text: str, memo: dict[str, Any] | None = None) -> dict[str, Any] | None:
    """Devuelve {"acciones": [...], "respuesta": str} o None si no está seguro.

    memo: lo que la voz recuerda entre pedidos (el último parlante usado) y la música por defecto."""
    t = norm(text)
    for w, n in WORD_NUMS.items():
        t = re.sub(rf"\b{w}\b", str(n), t)
    if not t:
        return None
    cat = _Cat(hass, rooms)
    S = hass.states
    rms = cat.find_rooms(t)
    everywhere = any(w in _words(t) for w in WORDS_ALL) and not rms

    # ---------- escenas: "activá la escena cine", "modo noche" ----------
    scenes = [e for e in cat.all_eqs() if e["id"].split(".")[0] in ("scene", "script")]
    for e in sorted(scenes, key=lambda e: -len(e["n"])):
        if len(e["n"]) >= 3 and re.search(r"(?:^|\s)" + re.escape(e["n"]) + r"(?:\s|$)", t) and (re.search(r"\b(escena|modo|rutina|activ|pone|pon)", t) or t == e["n"]):
            return {"acciones": [_act(e["id"].split(".")[0] + ".turn_on", [e["id"]])], "respuesta": f"Listo, activé {e['nombre']}."}

    # ---------- música (antes que todo: "poné la canción Persiana americana" no es una persiana) ----------
    res = _music(hass, cat, t, rms, memo if memo is not None else {})
    if res is not False:
        return res

    # ---------- preguntas: "¿está prendida la luz del baño?", "¿qué temperatura hace en el living?" ----------
    if re.match(r"^(esta|estan|quedo|quedaron|que|cuanto|cuantos|cuantas|hay)\b", t) or "temperatura hace" in t:
        if "temperatura" in t or "calor" in t or "frio" in t:
            vals = []
            for r in (rms or cat.rooms):
                for e in r["eqs"]:
                    st = S.get(e["id"])
                    if st and e["kind"] == "climate" and st.attributes.get("current_temperature") is not None:
                        vals.append(f"{r['name']}: {st.attributes['current_temperature']}°")
            temps = [f"{s.attributes.get('friendly_name')}: {s.state}°" for s in S.async_all("sensor") if s.attributes.get("device_class") == "temperature" and s.state not in ("unknown", "unavailable")]
            if rms:
                temps = [x for x in temps if any(r["n"] in norm(x) for r in rms)]
            vals = vals or temps[:4]
            return {"acciones": [], "respuesta": ("Hace " + ", ".join(vals) + ".") if vals else "No tengo sensores de temperatura para responderte eso."}
        kinds = {k for k in ("light", "climate", "fan", "cover", "tv", "music", "switch") if _has_type(t, k)} or {"light"}
        eqs = cat.find_named(t, kinds) or cat.all_eqs(rms or None, kinds)
        if not eqs:
            return None
        on = [e for e in eqs if (st := S.get(e["id"])) and st.state not in ("off", "closed", "unavailable", "unknown", "standby", "idle", "paused")]
        if not on:
            return {"acciones": [], "respuesta": f"No, está todo apagado{_place(rms)}."}
        names = ", ".join(e["nombre"] for e in on[:4]) + (" y más" if len(on) > 4 else "")
        return {"acciones": [], "respuesta": f"Sí, {'está prendido' if len(on) == 1 else 'están prendidos'}: {names}."}

    # ---------- clima: temperatura y modos ----------
    if _has_type(t, "climate") or re.search(r"\bgrados\b", t):
        targets = cat.find_named(t, {"climate"}) or cat.all_eqs(rms or (None if everywhere else None), {"climate"})
        if not rms and not cat.find_named(t, {"climate"}) and len(targets) > 1 and not everywhere:
            return {"acciones": [], "respuesta": "¿Qué aire? Decime el ambiente, por ejemplo «el aire del dormitorio»."}
        if not targets:
            return None
        ids = [e["id"] for e in targets]
        temp = _num(t, r"(\d{2}(?:[.,]\d)?)\s*(?:grados|°)?") if re.search(r"\b\d{2}\b", t) else None
        mode = "cool" if re.search(r"\b(frio|enfri)", t) else "heat" if re.search(r"\b(calor|calefa|calient)", t) else "dry" if "deshumid" in t or re.search(r"\bseco\b", t) else "fan_only" if "ventila" in t else None
        if re.search(OFF, t):
            return {"acciones": [_act("climate.turn_off", ids)], "respuesta": f"Listo, apagué el aire{_place(rms)}."}
        if temp is not None and 16 <= temp <= 30:
            return {"acciones": [_act("climate.set_temperature", ids, temperature=temp, hvac_mode=mode)], "respuesta": f"Listo, puse el aire en {temp:g}°{_place(rms)}."}
        if mode:
            return {"acciones": [_act("climate.set_hvac_mode", ids, hvac_mode=mode)], "respuesta": f"Listo, puse el aire en {'frío' if mode == 'cool' else 'calor' if mode == 'heat' else 'seco' if mode == 'dry' else 'ventilación'}{_place(rms)}."}
        if re.search(ON, t):
            return {"acciones": [_act("climate.turn_on", ids)], "respuesta": f"Listo, prendí el aire{_place(rms)}."}
        return None

    # ---------- persianas / cortinas ----------
    if _has_type(t, "cover"):
        targets = cat.find_named(t, {"cover"}) or cat.all_eqs(rms or None, {"cover"})
        if not targets or (not rms and not cat.find_named(t, {"cover"}) and len(targets) > 1 and not everywhere):
            return None if not targets else {"acciones": [], "respuesta": "¿Qué persiana? Decime el ambiente."}
        ids = [e["id"] for e in targets]
        pct = _num(t, r"(\d{1,3})\s*(?:%|por ciento)") or (50 if "mitad" in t else None)
        if pct is not None:
            return {"acciones": [_act("cover.set_cover_position", ids, position=int(pct))], "respuesta": f"Listo, dejé la persiana al {int(pct)}%{_place(rms)}."}
        if re.search(STOP, t):
            return {"acciones": [_act("cover.stop_cover", ids)], "respuesta": "Listo, la frené."}
        if re.search(OPEN, t):
            return {"acciones": [_act("cover.open_cover", ids)], "respuesta": f"Listo, subí la persiana{_place(rms)}."}
        if re.search(CLOSE, t):
            return {"acciones": [_act("cover.close_cover", ids)], "respuesta": f"Listo, bajé la persiana{_place(rms)}."}
        return None

    # ---------- teles ----------
    if _has_type(t, "tv"):
        players = cat.find_named(t, {"tv"}) or cat.all_eqs(rms or None, {"tv"})
        if not players:
            return None
        ids = [e["id"] for e in players]
        if "volumen" in t:
            lvl = _volume(S, ids, t)
            return {"acciones": [_act("media_player.volume_set", ids, volume_level=lvl)], "respuesta": "Listo."}
        if re.search(r"\b(paus|par[ae]|detene|frena)", t):
            return {"acciones": [_act("media_player.media_pause", ids)], "respuesta": "Listo, pausé."}
        if re.search(OFF, t):
            return {"acciones": [_act("media_player.turn_off", ids)], "respuesta": f"Listo, apagué la tele{_place(rms)}."}
        if re.search(ON, t):
            return {"acciones": [_act("media_player.turn_on", ids)], "respuesta": f"Listo, prendí la tele{_place(rms)}."}
        return None

    # ---------- ventiladores ----------
    if _has_type(t, "fan"):
        targets = cat.find_named(t, {"fan"}) or cat.all_eqs(rms or None, {"fan"})
        if not targets:
            return None
        ids = [e["id"] for e in targets]
        pct = _num(t, r"(\d{1,3})\s*(?:%|por ciento)")
        if pct is not None:
            return {"acciones": [_act("fan.set_percentage", ids, percentage=int(pct))], "respuesta": f"Listo, ventilador al {int(pct)}%."}
        if re.search(OFF, t):
            return {"acciones": [_act("fan.turn_off", ids)], "respuesta": f"Listo, apagué el ventilador{_place(rms)}."}
        if re.search(ON, t):
            return {"acciones": [_act("fan.turn_on", ids)], "respuesta": f"Listo, prendí el ventilador{_place(rms)}."}
        return None

    # ---------- "apagá todo" ----------
    is_off, is_on = bool(re.search(OFF, t)), bool(re.search(ON, t))
    explicit = {k for k in ("light", "switch") if _has_type(t, k)}
    if is_off and not explicit and ("todo" in _words(t) or "todas" in _words(t)):
        kinds = {"light"} if not rms else {"light", "fan", "climate", "tv"}
        by_domain: dict[str, list[str]] = {}
        for e in cat.all_eqs(rms or None, kinds):
            by_domain.setdefault(e["id"].split(".")[0], []).append(e["id"])
        acts = [_act(f"{d}.turn_off", ids) for d, ids in by_domain.items() if d in ("light", "switch", "fan", "climate", "media_player", "input_boolean")]
        return {"acciones": acts, "respuesta": f"Listo, apagué todo{_place(rms) or ' (las luces de la casa)'}."} if acts else None

    # ---------- luces y enchufes ----------
    if is_on or is_off or re.search(r"\d{1,3}\s*(%|por ciento)", t):
        kinds = explicit or {"light"}
        named = cat.find_named(t, kinds if explicit else {"light", "switch"})
        if named:
            targets = named
        elif rms:
            targets = cat.all_eqs(rms, kinds)
        elif everywhere:
            targets = cat.all_eqs(None, kinds)
        else:
            return None  # "prendé la luz" sin decir dónde: no adivinar
        if not targets:
            return None
        pct = _num(t, r"(\d{1,3})\s*(?:%|por ciento)")
        acts = []
        lights = [e["id"] for e in targets if e["id"].startswith("light.")]
        sws = [e["id"] for e in targets if e["id"].startswith(("switch.", "input_boolean."))]
        verb_on = not is_off
        if lights:
            acts.append(_act("light.turn_on" if verb_on else "light.turn_off", lights, brightness_pct=int(pct) if (pct is not None and verb_on) else None))
        for i in sws:
            acts.append(_act(i.split(".")[0] + (".turn_on" if verb_on else ".turn_off"), [i]))
        what = named[0]["nombre"].lower() if named and len(named) == 1 else ("las luces" if len(targets) > 1 else "la luz")
        pct_txt = f" al {int(pct)}%" if pct is not None and verb_on else ""
        return {"acciones": acts, "respuesta": f"Listo, {'prendí' if verb_on else 'apagué'} {what}{pct_txt}{_place(rms if not named else [])}."}
    return None
