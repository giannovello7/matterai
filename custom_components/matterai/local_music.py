"""Música por voz, gratis: "poné música en el quincho", "poné Soda Stereo en el dormitorio".

El cliente nunca nombra el parlante: cada ambiente ya trae el suyo (speakers.py). Si no dice dónde,
se usa el que está sonando, después el último que usó y, si la casa tiene uno solo, ese.

Entiende:
- poner: "poné música", "reproducí música en el quincho", "poné Soda Stereo", "poné la canción
  Persiana americana de Soda Stereo", "el disco Signos", "la playlist Rock nacional", "radio Mitre",
  "algo de los Redondos", "agregá X a la cola", "después poné X", "poné música en toda la casa";
- controlar: pausá / pará / apagá la música, seguí, siguiente, anterior, volumen al 30, más fuerte,
  bajá un poco, silenciá, aleatorio, repetí;
- pasar: "pasá la música al dormitorio";
- preguntar: "¿qué está sonando?".
"""

from __future__ import annotations

import re
from typing import Any

from homeassistant.core import HomeAssistant

from .local_voice import _act, _has_type, _place

PLAY = r"(?:pone|pon|poneme|ponme|ponele|poneles|reproduci|reproducime|reproduce|toca|tocame|tocanos|quiero escuchar|quiero oir|escuchar|pasame|mandame|largame|tirame|agrega|agregame|suma|sumale|encola|que suene|que suenen|hace sonar|haceme sonar)"
# verbos que sólo pueden ser música ("reproducí Persiana americana" no es una persiana)
STRONG_PLAY = r"^(?:che |dale |por favor )?(?:reproduci|reproducime|reproduce|toca|tocame|tocanos|quiero escuchar|quiero oir|escuchar|que suene|que suenen|hace sonar|haceme sonar)\b"
AGAIN = r"\b(de nuevo|otra vez|desde el principio|desde el comienzo|de cero)\b"
MUSIC_WORDS = r"\b(musica|cancion|canciones|tema|temas|disco|album|playlist|lista|radio|parlante|parlantes|audio|artista)\b"
OTHER_TYPES = ("light", "climate", "cover", "fan", "switch", "tv")
WHOLE = r"\b(toda la casa|todos lados|todas partes|todos los parlantes|todos los ambientes|en todos)\b"

Q_ASK = r"^(?:que|quien|cual)\b.*\b(suena|sonando|cancion|tema|canta|escuchando|esta puesto|es esto)\b"
TRANSFER = r"\b(pasa|pasala|pasame|lleva|llevala|llevame|move|movela|mueve|cambia|manda|mandala)\b"
PAUSE = r"\b(pausa|pausala|pausa la|pausar|deten\w*|frena\w*)\b|\bpara(?:la)? (?:la |el )?(?:musica|cancion|tema|parlante|audio)\b|^para(?:la)?$"
NEXT = r"\b(siguiente|proxim[ao]|salte\w*|salta\w*|otra cancion|otro tema|cambia (?:de )?(?:tema|cancion)|pasa (?:de |el |la )?(?:tema|cancion))\b"
PREV = r"\b(anterior|la de antes|el de antes|volve (?:al|a la) (?:tema|cancion))\b"
RESUME = r"\b(segui\w*|continua\w*|reanuda\w*|despausa\w*|play|volve a poner|que siga)\b"
VOL = r"\b(volumen|fuerte|despacio|suave|bajito|mas alto|mas bajo|subile|subila|subilo|bajale|bajala|bajalo)\b"
MUTE_ON = r"\b(silencia\w*|mutea\w*|mute)\b"
MUTE_OFF = r"\b(desmutea\w*|saca\w* (?:el )?silencio|activa (?:el )?sonido)\b"
SHUFFLE = r"\b(aleatori\w*|mezcla\w*|shuffle)\b"
REPEAT = r"\b(repet\w*|repeti\w*|en bucle|loop)\b"
GENERIC = {"", "musica", "la musica", "algo", "algo de musica", "un poco de musica", "algo para escuchar", "algo lindo", "musica linda", "musica por favor", "un poco",
           "spotify", "musica de spotify", "algo de spotify", "youtube music", "la musica de siempre", "mi musica", "mis canciones"}


def volume(S, ids: list[str], t: str) -> float:
    """Nivel de volumen (0 a 1) pedido: "al 30", "al máximo", "más fuerte", "bajá un poco"."""
    m = re.search(r"\b(\d{1,3})\s*(?:%|por ciento)?\b", t)
    if m and 0 <= int(m.group(1)) <= 100:
        return int(m.group(1)) / 100
    if re.search(r"\bmaxim\w*\b", t):
        return 1.0
    if re.search(r"\bminim\w*\b", t):
        return 0.1
    if "mitad" in t:
        return 0.5
    cur = [S.get(i).attributes.get("volume_level") for i in ids if S.get(i) and S.get(i).attributes.get("volume_level") is not None]
    base = cur[0] if cur else 0.3
    step = 0.2 if re.search(r"\b(mucho|bastante|bien)\b", t) else 0.06 if re.search(r"\b(poco|poquito|toque|apenas)\b", t) else 0.12
    down = re.search(r"\b(baja\w*|mas bajo|despacio|suave|bajito|menos)\b", t)
    return round(max(0.02, min(1.0, base + (-step if down else step))), 2)


def music(hass: HomeAssistant, cat, t: str, rms: list[dict[str, Any]], memo: dict[str, Any]) -> dict[str, Any] | None | bool:
    """Acciones de música, None si es de música pero no hay cómo, o False si el pedido no es de música."""
    S = hass.states
    state = lambda e: (S.get(e).state if S.get(e) else "unavailable")  # noqa: E731
    has_music = bool(re.search(MUSIC_WORDS, t))
    # una luz que se llama como el ambiente ("Quincho") no hace que "poné Soda Stereo en el quincho" sea de luces
    room_names = {r["n"] for r in cat.rooms}
    named = [e for e in cat.find_named(t, {"light", "switch", "fan", "climate", "cover", "tv"}) if e["n"] not in room_names]
    other = any(_has_type(t, k) for k in OTHER_TYPES) or bool(named)
    starts_play = bool(re.match(rf"^(?:che |dale |por favor )?{PLAY}\b", t))
    control = re.search(f"{Q_ASK}|{PAUSE}|{NEXT}|{PREV}|{RESUME}|{MUTE_ON}|{MUTE_OFF}|{SHUFFLE}|{REPEAT}", t)
    if _has_type(t, "tv") and not has_music:
        return False  # la tele tiene su propio camino
    strong = bool(re.match(STRONG_PLAY, t))
    if not (has_music or strong or (starts_play and not other) or (control and not other) or (re.search(VOL, t) and not other)):
        return False

    # ---------- parlantes ----------
    all_spk: list[str] = []
    for r in cat.rooms:
        if r.get("spk") and r["spk"] not in all_spk:
            all_spk.append(r["spk"])
    if cat.everywhere and cat.everywhere not in all_spk:
        all_spk.append(cat.everywhere)
    playing = [e for e in all_spk if state(e) == "playing"]
    paused = [e for e in all_spk if state(e) == "paused"]
    whole = bool(re.search(WHOLE, t))
    if whole:
        targets = [cat.everywhere] if cat.everywhere else list(dict.fromkeys(r["spk"] for r in cat.rooms if r.get("spk")))
        where = " en toda la casa"
    elif rms:
        targets = list(dict.fromkeys(r["spk"] for r in rms if r.get("spk")))
        where = _place(rms)
        if not targets:
            return {"acciones": [], "respuesta": f"No tengo un parlante para música{where}."}
    else:
        targets, where = [], ""
    if not all_spk:
        return {"acciones": [], "respuesta": "No encontré parlantes con Music Assistant en la casa."}
    last = [e for e in memo.get("last") or [] if e in all_spk]

    def room_of(eid: str) -> str:
        for r in cat.rooms:
            if r.get("spk") == eid:
                return " en " + r["name"]
        return ""

    def pick(*pools: list[str]) -> list[str]:
        for p in pools:
            if p:
                return p
        return all_spk[:1] if len(all_spk) == 1 else []

    def done(acts: list[dict[str, Any]], said: str, used: list[str]) -> dict[str, Any]:
        memo["last"] = used
        return {"acciones": acts, "respuesta": said}

    ask_where = {"acciones": [], "respuesta": "¿En qué ambiente? Por ejemplo «poné música en el quincho»."}

    # ---------- ¿qué está sonando? ----------
    if re.search(Q_ASK, t):
        src = targets or playing
        if not src or all(state(e) != "playing" for e in src):
            return {"acciones": [], "respuesta": f"No está sonando nada{where}."}
        e = next(e for e in src if state(e) == "playing")
        a = S.get(e).attributes
        title, artist = a.get("media_title"), a.get("media_artist")
        if not title:
            return {"acciones": [], "respuesta": f"Está sonando música{room_of(e)}, pero no sé qué tema es."}
        return {"acciones": [], "respuesta": f"Está sonando {title}{' de ' + artist if artist else ''}{room_of(e)}."}

    # ---------- pasar la música a otro ambiente ----------
    if targets and not whole and re.search(TRANSFER, t) and not re.search(NEXT, t):
        src = [e for e in playing + paused if e not in targets]
        if not src:
            return {"acciones": [], "respuesta": "No hay música sonando para pasar."}
        return done([_act("music_assistant.transfer_queue", targets[:1], source_player=src[0])], f"Listo, paso la música{where}.", targets[:1])

    # ---------- controles sobre lo que está sonando ----------
    cur = pick(targets, playing, last)
    if re.search(MUTE_OFF, t):
        return done([_act("media_player.volume_mute", cur or all_spk, mute=False)], "Listo.", cur) if (cur or all_spk) else None
    if re.search(MUTE_ON, t):
        if not cur:
            return {"acciones": [], "respuesta": "No hay música sonando."}
        return done([_act("media_player.volume_mute", cur, mute=True)], f"Listo, silencié la música{where or room_of(cur[0])}.", cur)
    if re.search(PAUSE, t) or (re.search(r"\b(apaga\w*|corta\w*)\b", t) and (has_music or "parlante" in t)):
        src = targets or playing
        if not src:
            return {"acciones": [], "respuesta": "No hay música sonando."}
        word = "apagué la música" if re.search(r"\b(apaga\w*|corta\w*)\b", t) else "pausé la música"
        return done([_act("media_player.media_pause", src)], f"Listo, {word}{where or (room_of(src[0]) if len(src) == 1 else '')}.", src)
    if re.search(NEXT, t):
        if not cur:
            return {"acciones": [], "respuesta": "No hay música sonando."}
        return done([_act("media_player.media_next_track", cur)], "Listo, la siguiente.", cur)
    if re.search(PREV, t):
        if not cur:
            return {"acciones": [], "respuesta": "No hay música sonando."}
        return done([_act("media_player.media_previous_track", cur)], "Listo, la anterior.", cur)
    if re.search(VOL, t) or re.search(r"\b(subi\w*|baja\w*)\b.*\b(musica|parlante|volumen)\b", t):
        if not cur:
            return ask_where if not playing else None
        lvl = volume(S, cur, t)
        return done([_act("media_player.volume_set", cur, volume_level=lvl)], f"Listo, volumen al {round(lvl * 100)}%.", cur)
    if re.search(SHUFFLE, t):
        if not cur:
            return {"acciones": [], "respuesta": "No hay música sonando."}
        off = bool(re.search(r"\b(saca\w*|desactiva\w*|sin|apaga\w*)\b", t))
        return done([_act("media_player.shuffle_set", cur, shuffle=not off)], "Listo, " + ("sin aleatorio." if off else "en aleatorio."), cur)
    if re.search(REPEAT, t) and not starts_play:
        if not cur:
            return {"acciones": [], "respuesta": "No hay música sonando."}
        mode = "off" if re.search(r"\b(saca\w*|desactiva\w*|no )\b", t) else "one" if re.search(r"\b(esta|este|la cancion|el tema)\b", t) else "all"
        return done([_act("media_player.repeat_set", cur, repeat=mode)], "Listo.", cur)
    if re.search(AGAIN, t) and re.search(r"\b(cancion|tema|esta|esto)\b", t) and cur:
        return done([_act("media_player.media_seek", cur, seek_position=0)], "Listo, otra vez desde el principio.", cur)
    if re.search(RESUME, t) and not starts_play:
        src = targets or paused or last
        if not src:
            return {"acciones": [], "respuesta": "Ya está sonando."} if playing else ask_where
        return done([_act("media_player.media_play", src)], f"Listo, sigo con la música{where or room_of(src[0])}.", src)

    # ---------- poner música ----------
    m = re.search(rf"\b{PLAY}\b\s*(.*)$", t)
    if not m and not (has_music and re.search(r"\b(prend\w*|encend\w*|activ\w*|quiero|dale)\b", t)) and not (has_music and rms):
        return None
    q = m.group(1) if m else ""
    enqueue = "add" if re.search(r"\b(agrega\w*|suma\w*|encola\w*|a la cola)\b", t) else "next" if re.search(r"\b(despues|a continuacion|luego|que siga)\b", t) else None
    # sacar el lugar y los rellenos: queda sólo lo que quieren escuchar
    for r in rms:
        q = re.sub(rf"\s*\b(?:en|para|por|a)?\s*(?:el|la|los|las)?\s*(?:parlante\s+(?:del?|de la)\s+)?{re.escape(r['n'])}\b", " ", q)
    q = re.sub(rf"\s*(?:en\s+)?{WHOLE}", " ", q)
    q = re.sub(r"\b(a la cola|a continuacion|despues|luego|por favor|porfa|porfis|ahora|che|dale)\b", " ", q)
    q = re.sub(r"\s+", " ", q).strip()
    q = re.sub(r"(?:\s+(?:y|e|en|o))+$", "", " " + q).strip()  # "en el quincho y en el dormitorio" deja colgado un "y"
    q = re.sub(r"^(?:me |nos |le )", "", q)
    media_type = artist = None
    radio_mode = False
    if (mm := re.match(r"^(?:la |una )?(?:cancion|tema)\s+(.+)$", q)):
        media_type, q = "track", mm.group(1)
    elif (mm := re.match(r"^(?:el |un )?(?:disco|album)\s+(.+)$", q)):
        media_type, q = "album", mm.group(1)
    elif (mm := re.match(r"^(?:la |mi |una )?(?:playlist|lista(?: de reproduccion)?)\s+(?:de\s+)?(.+)$", q)):
        media_type, q = "playlist", mm.group(1)
    elif (mm := re.match(r"^(?:la )?radio\s+(.+)$", q)):
        media_type, q = "radio", mm.group(1)
    elif (mm := re.match(r"^(?:algo de|un poco de|un tema de|unos temas de|temas de|canciones de|musica de|la musica de|lo de|a)\s+(.+)$", q)):
        q, radio_mode = mm.group(1), True  # un artista y después parecidos
    elif (mm := re.match(r"^algo\s+(.{4,})$", q)) and q not in GENERIC:
        q = mm.group(1)  # "algo tranquilo", "algo para bailar"
    elif q in ("radio", "la radio", "una radio", "alguna radio"):
        media_type, q = "radio", ""  # una radio favorita
    if media_type in ("track", "album") and (mm := re.match(r"^(.+?)\s+de\s+(.{3,})$", q)):
        q, artist = mm.group(1), mm.group(2)
    q = q.strip(" .")

    tg = targets or pick(playing, last)  # sin decir dónde: donde ya está sonando
    if not tg:
        if len(all_spk) > 1:
            return ask_where
        tg = all_spk[:1]
    where = where or room_of(tg[0]) if len(tg) == 1 else where
    if q in GENERIC:
        if enqueue:
            return None
        resume = [e for e in tg if state(e) == "paused" and S.get(e).attributes.get("media_title")]
        acts = []
        if resume:
            acts.append(_act("media_player.media_play", resume))
        fresh = [e for e in tg if e not in resume]
        if fresh:
            acts.append(_act("matterai.play_something", fresh, media_query=None if media_type == "radio" else memo.get("music_default") or None, media_type=media_type))
        what = "sigo con la música" if resume and not fresh else "pongo una radio" if media_type == "radio" else "pongo música"
        return done(acts, f"Listo, {what}{where}.", tg)
    nice = lambda x: " ".join(w if w in ("de", "del", "la", "el", "los", "las", "y") else w.capitalize() for w in x.split())  # noqa: E731
    said = f"{nice(q)} de {nice(artist)}" if artist else nice(q)
    verb = "agrego a la cola" if enqueue == "add" else "pongo después" if enqueue == "next" else "pongo"
    return done([_act("music_assistant.play_media", tg, media_query=q, media_type=media_type, media_artist=artist, enqueue=enqueue, radio_mode=radio_mode or None)],
                f"Listo, {verb} {said}{where}.", tg)
