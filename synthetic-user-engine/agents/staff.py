"""Operaciones que comparten las áreas internas: bandeja de solicitudes, eventos, comentarios e historial.

Cada método llama a la API como lo haría la interfaz y controla el contrato de la respuesta.
Las reglas que cruzan varias personas se controlan en los recorridos.
"""
from __future__ import annotations

from typing import Any, Iterable

from core.report import ensure
from core.session import Session
from generators.data import Slot, hhmm


class Staff:
    role = ""
    comment_area = "ceremonial"

    def __init__(self, session: Session):
        self.s = session

    @property
    def username(self) -> str:
        return self.s.username or ""

    # -- solicitudes ---------------------------------------------------------------------------

    def inbox(self, *statuses: str) -> list[dict[str, Any]]:
        params = [("status", status) for status in statuses]
        rows = self.s.json("GET", "/admin/event-requests", params=params)
        ensure(isinstance(rows, list), "la bandeja de solicitudes no devolvió una lista")
        return rows

    def find_request(self, uuid: str) -> dict[str, Any]:
        match = next((r for r in self.inbox() if r.get("trackingUuid") == uuid), None)
        ensure(match is not None, f"la solicitud {uuid} no aparece en la bandeja de {self.username}")
        return match

    def request_to_review(self, request_id: int) -> dict[str, Any]:
        result = self.s.json("PATCH", f"/admin/event-requests/{request_id}/status", json={"newStatus": "EN_REVISION"})
        ensure(result.get("status") == "EN_REVISION", f"la solicitud no pasó a EN_REVISION: {result}")
        return result

    def reject_request(self, request_id: int, reason: str | None, *, expect: int | Iterable[int] = 200) -> Any:
        body: dict[str, Any] = {"newStatus": "RECHAZADO"}
        if reason is not None:
            body["reason"] = reason
        res = self.s.request("PATCH", f"/admin/event-requests/{request_id}/status", json=body, expect=expect)
        return res.json() if res.content else None

    def convert(self, request_id: int, *, requires_tech: bool, mode: str | None,
                expect: int | Iterable[int] = 200) -> Any:
        res = self.s.request("POST", f"/admin/event-requests/{request_id}/convert-to-event",
                             json={"requiresTech": requires_tech, "techSupportMode": mode}, expect=expect)
        return res.json() if res.content else None

    def request_history(self, request_id: int) -> list[dict[str, Any]]:
        return self.s.json("GET", f"/admin/event-requests/{request_id}/history")

    # -- eventos -------------------------------------------------------------------------------

    def event(self, event_id: int) -> dict[str, Any]:
        return self.s.json("GET", f"/api/events/{event_id}")

    def active_event_ids(self) -> set[int]:
        return {e["id"] for e in self.s.json("GET", "/api/events")}

    def create_event(self, body: dict[str, Any], *, expect: int | Iterable[int] = 201) -> Any:
        res = self.s.request("POST", "/api/events", json=body, expect=expect)
        return res.json() if res.content else None

    def update_event(self, event_id: int, body: dict[str, Any], *, expect: int | Iterable[int] = 200) -> Any:
        res = self.s.request("PATCH", f"/api/events/{event_id}", json=body, expect=expect)
        return res.json() if res.content else None

    def change_status(self, event_id: int, to: str, *, expect: int | Iterable[int] = 200, **extra: Any) -> Any:
        res = self.s.request("POST", f"/api/events/{event_id}/status", json={"to": to, **extra}, expect=expect)
        return res.json() if res.content else None

    def reserve(self, event_id: int) -> dict[str, Any]:
        result = self.change_status(event_id, "RESERVADO")
        ensure(result.get("status") == "RESERVADO", f"el evento no quedó RESERVADO: {result}")
        return result

    def soft_delete(self, event_id: int) -> None:
        self.s.request("PATCH", f"/api/events/{event_id}/soft-delete", expect=204)

    def comment(self, event_id: int, text: str) -> dict[str, Any]:
        created = self.s.json("POST", f"/api/events/{event_id}/comments", json={"body": text}, expect=201)
        ensure(created.get("body") == text, f"el comentario guardado no coincide: {created}")
        return created

    def audit(self, event_id: int) -> list[dict[str, Any]]:
        page = self.s.json("GET", f"/api/audit/{event_id}", params={"size": 200})
        return page.get("entries") or []

    def availability(self, slot: Slot, *, ignore_event_id: int | None = None) -> dict[str, Any]:
        body: dict[str, Any] = {
            "date": slot.date.isoformat(),
            "scheduleFrom": hhmm(slot.start),
            "scheduleTo": hhmm(slot.end),
            "bufferBeforeMin": slot.buffer_before,
            "bufferAfterMin": slot.buffer_after,
            "ignoreEventId": ignore_event_id,
        }
        if slot.space_id is not None:
            body["spaceId"] = slot.space_id
        else:
            body["freeLocation"] = slot.free_location
        return self.s.json("POST", "/api/availability/check", json=body)
