"""Un evento de Rectorado desplaza a otro y Ceremonial resuelve el conflicto."""
from __future__ import annotations

from core.report import JourneyRecorder, ensure
from generators.data import hhmm
from simulation.context import Context


def prioridad_rectorado(ctx: Context, j: JourneyRecorder) -> None:
    p, data = ctx.personas, ctx.data
    slot = ctx.agenda.free_slot()

    with j.step("Ceremonial carga un evento de prioridad media y lo reserva"):
        body = data.internal_event(slot, ctx.tag, ctx.department_id())
        displaced = p.ceremonial.create_event(body)["eventId"]
        p.ceremonial.reserve(displaced)
        j.note(f"evento {displaced}, {slot}")

    with j.step("Administración carga un acto de Rectorado en el mismo lugar y horario"):
        high = p.administracion.create_event(
            data.internal_event(slot, ctx.tag, ctx.department_id(), area="Rectorado", priority="MEDIUM"))
        ensure(high["priority"] == "HIGH", f"el área Rectorado deriva prioridad alta, pero quedó {high['priority']}")
        conflicts = high.get("priorityConflicts") or []
        ensure(len(conflicts) == 1 and conflicts[0]["displacedEventId"] == displaced,
               f"conflictos informados: {conflicts}")
        conflict_id = conflicts[0]["conflictId"]
        high_id = high["eventId"]
        j.note(f"evento alto {high_id}, conflicto {conflict_id}")

    with j.step("El evento desplazado queda marcado para reprogramar y el conflicto, pendiente"):
        ensure(p.ceremonial.event(displaced)["requiresRebooking"] is True, "el desplazado no quedó marcado")
        ensure(any(c["conflictId"] == conflict_id for c in p.ceremonial.pending_conflicts()),
               "el conflicto no figura entre los pendientes")

    with j.step("Técnica puede ver el conflicto pero no resolverlo"):
        p.tecnica.s.json("GET", "/api/priority/conflicts", params={"eventId": high_id})
        p.tecnica.s.request("POST", "/api/priority/decisions", expect=403, json={
            "conflictId": conflict_id, "decision": "KEEP_ORIGINAL", "reason": "intento de Técnica"})

    target = ctx.agenda.free_slot()
    with j.step("Ceremonial reprograma el evento desplazado a un horario libre"):
        p.ceremonial.decide(conflict_id, "REBOOK_OTHER", expect=201, target={
            "date": target.date.isoformat(), "from": hhmm(target.start), "to": hhmm(target.end),
            "spaceId": target.space_id})
        moved = p.ceremonial.event(displaced)
        ensure(moved["date"] == target.date.isoformat() and moved["scheduleFrom"] == hhmm(target.start),
               f"el desplazado quedó el {moved['date']} a las {moved['scheduleFrom']}")
        ensure(moved["status"] == "EN_REVISION" and not moved["ceremonialOk"] and not moved["technicalOk"],
               f"reubicar exige revisar de nuevo, pero quedó {moved['status']}")
        ensure(moved["requiresRebooking"] is False, "sigue marcado para reprogramar")
        ensure(all(c["conflictId"] != conflict_id for c in p.ceremonial.pending_conflicts()), "sigue pendiente")
        j.note(f"reprogramado a {target}")

    with j.step("Dos eventos de prioridad alta no se desplazan entre sí"):
        p.administracion.reserve(high_id)
        p.ceremonial.create_event(data.internal_event(slot, ctx.tag, ctx.department_id(), area="Rectorado"),
                                  expect=409)
        # El 409 no trae motivo en el cuerpo: se comprueba por su efecto sobre el primer acto.
        first = p.ceremonial.event(high_id)
        ensure(first["status"] == "RESERVADO" and first["requiresRebooking"] is False,
               f"el primer acto de Rectorado quedó {first['status']}, reprogramar={first['requiresRebooking']}")
        ensure(all(c["displacedEventId"] != high_id for c in p.ceremonial.pending_conflicts()),
               "se abrió un conflicto contra el primer acto de Rectorado")
