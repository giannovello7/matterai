"""Matte como asistente de Home Assistant: los parlantes Voice, el reloj y la app de HA le hablan al mismo Matte.

Se elige en Ajustes → Asistentes de voz → (el asistente) → Agente de conversación: «Matte».
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
        a = (self.hass.data.get(DOMAIN) or {}).get("asistente")
        user = None
        if user_input.context and user_input.context.user_id:
            user = await self.hass.auth.async_get_user(user_input.context.user_id)
        if a is None:
            out = {"say": "Matte no está activado en esta casa.", "session_id": user_input.conversation_id}
        else:
            out = await a.conversar(user, user_input.text, user_input.conversation_id, "voz")
        response = intent.IntentResponse(language=user_input.language)
        response.async_set_speech(out.get("say") or "Listo.")  # si propuso algo, Matte ya preguntó: la respuesta «sí» llega en el próximo pedido
        return conversation.ConversationResult(response=response, conversation_id=out.get("session_id") or user_input.conversation_id)
