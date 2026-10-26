"""Persona sin cuenta: consulta el catálogo y la disponibilidad, pide un evento y sigue el pedido."""
from __future__ import annotations

from typing import Any

from core.report import ensure
from core.session import Session
from generators.data import Slot, hhmm


class Solicitante:
    def __init__(self, session: Session):
        self.s = session

    def public_spaces(self) -> list[dict[str, Any]]:
        spaces = self.s.json("GET", "/public/catalogs/spaces", auth=False)
        ensure(isinstance(spaces, list) and spaces, "el catálogo público de espacios está vacío")
        return spaces

    def check_availability(self, slot: Slot) -> dict[str, Any]:
        body: dict[str, Any] = {
            "date": slot.date.isoformat(),
            "scheduleFrom": hhmm(slot.start),
            "scheduleTo": hhmm(slot.end),
            "bufferBeforeMin": slot.buffer_before,
            "bufferAfterMin": slot.buffer_after,
        }
        if slot.space_id is not None:
            body["spaceId"] = slot.space_id
        else:
            body["freeLocation"] = slot.free_location
        result = self.s.json("POST", "/public/availability/check", auth=False, json=body)
        for conflict in result.get("conflicts") or []:
            # La vista pública de un choque no identifica eventos internos ni a sus responsables.
            ensure("eventId" not in conflict and "internal" not in conflict,
                   f"la disponibilidad pública expone datos internos del evento que choca: {conflict}")
        return result

    def submit(self, body: dict[str, Any]) -> str:
        created = self.s.json("POST", "/public/event-requests", auth=False, json=body, expect=201)
        ensure(created.get("status") == "RECIBIDO", f"la solicitud nueva no quedó RECIBIDO: {created}")
        uuid = created.get("tracking_uuid")
        ensure(isinstance(uuid, str) and len(uuid) >= 32, f"la respuesta no trae un código de seguimiento: {created}")
        return uuid

    def track(self, uuid: str, *, contact_email: str | None = None) -> dict[str, Any]:
        res = self.s.request("GET", f"/public/track/{uuid}", auth=False, expect=200)
        tracking = res.json()
        ensure(tracking.get("trackingUuid") == uuid, f"el seguimiento devolvió otro pedido: {tracking}")
        event = tracking.get("event")
        ensure(not isinstance(event, dict) or set(event) <= {"status"},
               f"el seguimiento expone datos internos del evento: {event}")
        if contact_email:
            ensure(contact_email not in res.text, "el seguimiento público expone el correo del solicitante")
        return tracking

    def public_calendar(self) -> list[dict[str, Any]]:
        events = self.s.json("GET", "/public/events", auth=False)
        ensure(isinstance(events, list), "el calendario público no devolvió una lista")
        return events
