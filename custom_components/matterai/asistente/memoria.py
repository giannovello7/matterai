"""Lo que Matte sabe: de la casa (lo ven todos) y de cada persona (sólo esa persona).

Se guarda en el Home Assistant de la casa (.storage/matterai.matte_memoria), nunca en servidores de MatterAI
ni de Anthropic: Claude lo recibe sólo en el momento de responder. Cada persona ve, corrige y borra lo suyo
(y lo de la casa) desde la app o pidiéndoselo a Matte. El instalador no lo ve.
"""

from __future__ import annotations

import re
import secrets
import time
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

STORAGE_KEY = "matterai.matte_memoria"
MAX_POR_LISTA = 80
MAX_TEXTO = 300
MAX_RECHAZOS = 40
CASA = "casa"

# nunca se guarda: claves, tarjetas, documentos (aunque se lo pidan de pasada)
_PROHIBIDO = re.compile(
    r"(contrase[ñn]a|password|clave\s+(de|del|wifi|bancaria)|pin\b|tarjeta\s+de\s+cr[eé]dito|cbu|cvu|cvv|\b\d{13,19}\b|dni\s*\d)",
    re.IGNORECASE,
)


def texto_prohibido(texto: str) -> bool:
    return bool(_PROHIBIDO.search(texto or ""))


class Memoria:
    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store: Store = Store(hass, 1, STORAGE_KEY, private=True)
        self.data: dict[str, Any] = {"casa": [], "personas": {}, "rechazos": {}}

    async def async_load(self) -> None:
        raw = await self._store.async_load()
        if isinstance(raw, dict):
            self.data = {"casa": list(raw.get("casa") or []), "personas": dict(raw.get("personas") or {}), "rechazos": dict(raw.get("rechazos") or {}),
                         "ideas_avisadas": list(raw.get("ideas_avisadas") or [])}  # ideas de la semana ya avisadas (no se repiten)

    def _save(self) -> None:
        self._store.async_delay_save(lambda: self.data, 2)

    def _lista(self, quien: str) -> list[dict[str, Any]]:
        if quien == CASA:
            return self.data["casa"]
        return self.data["personas"].setdefault(quien, [])

    def de(self, user_id: str | None) -> dict[str, list[dict[str, Any]]]:
        return {"casa": list(self.data["casa"]), "mia": list(self.data["personas"].get(user_id, [])) if user_id else []}

    def agregar(self, user_id: str | None, texto: str, de_la_casa: bool) -> dict[str, Any]:
        texto = re.sub(r"\s+", " ", str(texto or "")).strip()[:MAX_TEXTO]
        if not texto:
            return {"ok": False, "error": "No hay nada para anotar."}
        if texto_prohibido(texto):
            return {"ok": False, "error": "Eso no lo guardo: claves, tarjetas ni documentos."}
        quien = CASA if de_la_casa or not user_id else user_id
        lista = self._lista(quien)
        low = texto.lower()
        for it in lista:
            if it["texto"].lower() == low:
                return {"ok": True, "id": it["id"], "ya_estaba": True}
        item = {"id": secrets.token_hex(4), "texto": texto, "t": int(time.time())}
        lista.append(item)
        del lista[:-MAX_POR_LISTA]
        self._save()
        return {"ok": True, "id": item["id"]}

    def borrar(self, user_id: str | None, item_id: str) -> bool:
        """Cada persona borra lo suyo y lo de la casa; nunca lo de otra persona."""
        for quien in ([user_id] if user_id else []) + [CASA]:
            lista = self._lista(quien)
            for i, it in enumerate(lista):
                if it["id"] == item_id:
                    del lista[i]
                    self._save()
                    return True
        return False

    def corregir(self, user_id: str | None, item_id: str, texto: str) -> bool:
        texto = re.sub(r"\s+", " ", str(texto or "")).strip()[:MAX_TEXTO]
        if not texto or texto_prohibido(texto):
            return False
        for quien in ([user_id] if user_id else []) + [CASA]:
            for it in self._lista(quien):
                if it["id"] == item_id:
                    it["texto"] = texto
                    self._save()
                    return True
        return False

    def borrar_todo(self, user_id: str) -> None:
        self.data["personas"].pop(user_id, None)
        self.data["rechazos"].pop(user_id, None)
        self._save()

    # propuestas que la persona ya rechazó: Matte no insiste
    def rechazar(self, user_id: str | None, titulo: str) -> None:
        lista = self.data["rechazos"].setdefault(user_id or CASA, [])
        t = str(titulo or "").strip()[:120]
        if t and t not in lista:
            lista.append(t)
            del lista[:-MAX_RECHAZOS]
            self._save()

    def rechazos(self, user_id: str | None) -> list[str]:
        return list(self.data["rechazos"].get(user_id or CASA, []))

    def exportar(self, user_id: str) -> dict[str, Any]:
        """Para «Privacidad y datos»: lo que Matte sabe de esta persona."""
        return {"mia": self.data["personas"].get(user_id, []), "casa": self.data["casa"], "rechazos": self.data["rechazos"].get(user_id, [])}
