"""Matte como asistente de Home Assistant: los parlantes Voice, el reloj y la app de HA le hablan al mismo Matte.

Se elige en Ajustes → Asistentes de voz → (el asistente) → Agente de conversación: «Matte».
Igual que el micrófono de la app: lo simple («prendé la luz del living») lo resuelve el modo gratis al instante y
sin costo; lo demás va a Matte (Claude), y si hay una charla abierta con Matte, todo sigue con él.
El que habla por un parlante no tiene usuario: Matte recuerda lo de la casa y arma con permisos de cliente
(nunca de administrador); lo delicado (cerraduras, alarma, portones) se confirma sólo en la app.
"""

from __future__ import annotations

from typing import Literal

from homeassistant.components import conversation
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import MATCH_ALL
from homeassistant.core import HomeAssistant
from homeassistant.helpers import intent
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback) -> None:
    async_add_entities([MatteAgent(hass, entry)])


class MatteAgent(conversation.ConversationEntity):
    _attr_has_entity_name = True
    _attr_name = "Matte"
    _attr_icon = "mdi:robot-happy-outline"

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.hass = hass
        self._attr_unique_id = f"{entry.entry_id}_matte"

    @property
    def supported_languages(self) -> list[str] | Literal["*"]:
        return MATCH_ALL

    async def async_process(self, user_input: conversation.ConversationInput) -> conversation.ConversationResult:
        rt = self.hass.data.get(DOMAIN) or {}
        a, brain = rt.get("asistente"), rt.get("voice")
        cid = user_input.conversation_id
        charla = bool(a and cid and cid in a.sesiones)  # hay una charla abierta con Matte: sigue con él
        if brain is not None and rt.get("dashboard") is not None:
            out = await brain.async_handle(user_input.text, rt["dashboard"].config, user_input.context, cid if charla else None)
            say, sid = out.get("say"), out.get("session_id")
        elif a is not None:
            user = await self.hass.auth.async_get_user(user_input.context.user_id) if user_input.context and user_input.context.user_id else None
            out = await a.conversar(user, user_input.text, cid, "voz")
            say, sid = out.get("say"), out.get("session_id")
        else:
            say, sid = "Matte no está activado en esta casa.", None
        response = intent.IntentResponse(language=user_input.language)
        response.async_set_speech(say or "Listo.")  # si propuso algo, Matte ya preguntó: el «sí» llega en el próximo pedido
        return conversation.ConversationResult(response=response, conversation_id=sid or cid)
