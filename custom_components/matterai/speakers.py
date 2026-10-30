"""El parlante de cada ambiente, sin que el cliente tenga que nombrarlo.

"Poné música en el quincho" tiene que sonar en el parlante del quincho aunque en Home Assistant
ese parlante figure tres veces (Google Cast, AirPlay, Music Assistant) y con otro nombre ("Altillo").
Para buscar y reproducir música hace falta el reproductor de Music Assistant, así que se elige ese.

Orden: el que eligió el instalador (`speaker:` en el ambiente) → uno de Music Assistant que ya esté
en el ambiente → el mejor de Music Assistant por área de HA, por nombre o por ser el "gemelo" de un
parlante del ambiente → nada (y la voz lo dice).
"""

from __future__ import annotations

import re
import unicodedata
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er

MA = "music_assistant"
# reproductores de Music Assistant que no son parlantes de la casa
NOT_SPEAKER = re.compile(r"\b(web|browser|pwa|carplay|chrome|iphone|android auto|telefono|celular)\b")
TV_LIKE = re.compile(r"\b(tv|tele|televisor|webos|projector|proyector|apple tv|fire tv|bravia)\b")
EVERYWHERE = re.compile(r"\b(everywhere|todos los parlantes|toda la casa|todos|whole home|casa entera)\b")


def norm(text: str) -> str:
    t = unicodedata.normalize("NFD", str(text or "").lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    t = re.sub(r"[^a-z0-9 ]+", " ", t)
    return re.sub(r"\s+", " ", t).strip()


class Speakers:
    """Datos de los reproductores de la casa, armados una vez por pedido."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        ent_reg, dev_reg, area_reg = er.async_get(hass), dr.async_get(hass), ar.async_get(hass)
        self.info: dict[str, dict[str, Any]] = {}
        for st in hass.states.async_all("media_player"):
            entry = ent_reg.async_get(st.entity_id)
            dev = dev_reg.async_get(entry.device_id) if entry and entry.device_id else None
            area_id = (entry.area_id if entry else None) or (dev.area_id if dev else None)
            area = area_reg.async_get_area(area_id) if area_id else None
            dev_name = (dev.name_by_user or dev.name) if dev else ""
            name = st.attributes.get("friendly_name") or dev_name or st.entity_id
            self.info[st.entity_id] = {
                "id": st.entity_id,
                "platform": entry.platform if entry else "",
                "name": norm(name),
                "dev": norm(dev_name or name),
                "model": norm(f"{dev.model or ''} {dev.manufacturer or ''}") if dev else "",
                "area": norm(area.name) if area else "",
                "area_id": norm(area_id or ""),
                "state": st.state,
                "hidden": bool(entry and (entry.hidden_by or entry.disabled_by)),
            }

    def is_ma(self, eid: str) -> bool:
        i = self.info.get(eid)
        return bool(i and i["platform"] == MA)

    def _usable(self, i: dict[str, Any]) -> bool:
        return i["platform"] == MA and not i["hidden"] and not NOT_SPEAKER.search(f"{i['name']} {i['model']}")

    def for_room(self, room_name: str, room_ids: list[str], chosen: str | None = None) -> str | None:
        """El reproductor de Music Assistant para poner música en este ambiente."""
        if chosen and chosen in self.info:
            return chosen
        rn = norm(room_name)
        avail = lambda i: i["state"] not in ("unavailable", "unknown")  # noqa: E731
        in_room = [self.info[e] for e in room_ids if e in self.info]
        mine = [i for i in in_room if self._usable(i)]
        if mine:
            # varios en el ambiente: el que responde, el que está en esa área de HA y que no sea una tele
            return sorted(mine, key=lambda i: (not avail(i), i["area"] != rn, bool(TV_LIKE.search(i["name"] + " " + i["model"]))))[0]["id"]
        twins = {i["dev"] for i in in_room if i["platform"] != MA and not TV_LIKE.search(i["name"] + " " + i["model"])}
        best, best_score = None, 0
        for i in self.info.values():
            if not self._usable(i) or EVERYWHERE.search(i["name"]):
                continue
            score = 0
            if rn and (i["area"] == rn or i["area_id"] == rn.replace(" ", "_")):
                score += 5
            if i["dev"] in twins:
                score += 4
            if rn and (i["name"] == rn or i["dev"] == rn):
                score += 4
            elif rn and len(rn) >= 4 and (re.search(rf"\b{re.escape(rn)}\b", i["name"]) or re.search(rf"\b{re.escape(rn)}\b", i["dev"])):
                score += 2
            if not score:
                continue
            if avail(i):
                score += 1.5
            if i["state"] == "playing":
                score += 0.5
            if TV_LIKE.search(i["name"] + " " + i["model"]):
                score -= 2
            if score > best_score:
                best, best_score = i["id"], score
        if best_score >= 2:
            return best
        # casa sin Music Assistant: el parlante común del ambiente (sirve para pausar, volumen, siguiente)
        plain = [i for i in in_room if not TV_LIKE.search(i["name"] + " " + i["model"]) and i["state"] != "unavailable"]
        return plain[0]["id"] if plain else None

    def everywhere(self, chosen: str | None = None) -> str | None:
        """Un grupo de "toda la casa" de Music Assistant, si existe."""
        if chosen and chosen in self.info:
            return chosen
        for i in self.info.values():
            if i["platform"] == MA and not i["hidden"] and EVERYWHERE.search(i["name"]) and i["state"] != "unavailable":
                return i["id"]
        return None
