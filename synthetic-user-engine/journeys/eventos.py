"""Recorridos de eventos cargados por las áreas: agenda, choques, conformidades y bajas."""
from __future__ import annotations

from core.report import JourneyRecorder, ensure
from generators.data import Slot, hhmm
from journeys.common import clock_add, codes, entry_types, race, status_post
from simulation.context import Context


def _create(ctx: Context, creator, slot: Slot, **kwargs) -> int:
    result = creator.create_event(ctx.data.internal_event(slot, ctx.tag, ctx.department_id(), **kwargs))
    ensure(result["status"] == "EN_REVISION", f"un alta manual nace en EN_REVISION, pero quedó {result['status']}")
    return result["eventId"]


def reprogramacion(ctx: Context, j: JourneyRecorder) -> None:
    p, data = ctx.personas, ctx.data
    slot = ctx.agenda.free_slot()

    with j.step("Administración carga un evento público y lo aprueba con ambas conformidades"):
        event_id = _create(ctx, p.administracion, slot, requires_tech=data.chance(0.5))
        p.administracion.update_event(event_id, {"internal": False})
        result = p.administracion.give_both_oks(event_id)
        ensure(result["status"] == "APROBADO", f"quedó {result['status']}")
        ensure(any(e["id"] == event_id for e in p.solicitante.public_calendar()), "no aparece en el calendario público")
        j.note(f"evento {event_id}, {slot}")

    target = ctx.agenda.free_slot()
    with j.step("Ceremonial lo cambia de fecha y el evento vuelve a revisión sin conformidades"):
        result = p.ceremonial.update_event(event_id, {"date": target.date.isoformat()})
        ensure(result["status"] == "EN_REVISION", f"tras mover la fecha quedó {result['status']}")
        event = p.ceremonial.event(event_id)
        ensure(not event["ceremonialOk"] and not event["technicalOk"], "las conformidades viejas sobrevivieron al cambio")
        ensure(all(e["id"] != event_id for e in p.solicitante.public_calendar()),
               "un evento en revisión sigue en el calendario público")
        ensure("SCHEDULE_CHANGE" in entry_types(p.ceremonial.audit(event_id)), "la auditoría no registra el cambio de agenda")

    with j.step("Ceremonial y Técnica vuelven a dar su conformidad"):
        p.ceremonial.give_ok(event_id, expect=202)
        ensure(p.tecnica.give_ok(event_id, expect=200)["status"] == "APROBADO", "no volvió a APROBADO")

    with j.step("Editar un dato que no es de agenda no reabre la revisión"):
        result = p.tecnica.update_event(event_id, {"observations": data.fake.sentence(nb_words=8)})
        ensure(result["status"] == "APROBADO", f"una observación devolvió el evento a {result['status']}")


def choque_de_espacio(ctx: Context, j: JourneyRecorder) -> None:
    p, data = ctx.personas, ctx.data
    slot = ctx.agenda.free_slot()
    slot.buffer_before = slot.buffer_after = 30

    with j.step("Ceremonial carga un evento con 30 minutos de armado y desarme, y lo reserva"):
        first = _create(ctx, p.ceremonial, slot)
        p.ceremonial.reserve(first)
        j.note(f"evento {first}, {slot}")

    with j.step("La disponibilidad interna informa el choque con ese evento"):
        check = p.tecnica.availability(slot)
        ensure(check["isAvailable"] is False, f"el horario reservado figura libre: {check}")
        ensure(any(c.get("eventId") == first for c in check.get("conflicts") or []), f"choques: {check.get('conflicts')}")

    with j.step("El solicitante ve el horario ocupado sin datos internos"):
        ensure(p.solicitante.check_availability(slot)["isAvailable"] is False, "la vista pública lo muestra libre")

    with j.step("Técnica no puede cargar otro evento de prioridad media en el mismo lugar y horario"):
        p.tecnica.create_event(data.internal_event(slot, ctx.tag, ctx.department_id()), expect=409)

    with j.step("El armado también ocupa el espacio: lo que termina dentro de él choca, lo que termina justo antes entra"):
        setup_start = clock_add(slot.start, -slot.buffer_before)
        inside = Slot(slot.date, clock_add(slot.start, -60), slot.start, space_id=slot.space_id)
        p.tecnica.create_event(data.internal_event(inside, ctx.tag, ctx.department_id()), expect=409)
        border = Slot(slot.date, clock_add(setup_start, -60), setup_start, space_id=slot.space_id)
        _create(ctx, p.tecnica, border)
        j.note(f"{hhmm(inside.start)}–{hhmm(inside.end)} choca; {hhmm(border.start)}–{hhmm(border.end)} entra")

    with j.step("Al rechazar el evento reservado, el horario se libera"):
        p.ceremonial.change_status(first, "RECHAZADO", reason=data.rejection_reason())
        ensure(p.tecnica.availability(slot)["isAvailable"] is True, "el horario sigue ocupado por un evento rechazado")
        p.tecnica.update_event(first, {"name": "no debería poder"}, expect=400)


def conformidades(ctx: Context, j: JourneyRecorder) -> None:
    p, data = ctx.personas, ctx.data

    with j.step("Pedir la conformidad del área ajena no la otorga: cada rol aprueba solo lo suyo"):
        event_id = _create(ctx, p.administracion, ctx.agenda.free_slot())
        result = p.ceremonial.change_status(event_id, "APROBADO", ceremonialOk=True, technicalOk=True, expect=202)
        ensure(result["missing"] == ["technical_ok"], f"faltantes informados: {result['missing']}")
        event = p.administracion.event(event_id)
        ensure(event["ceremonialOk"] and not event["technicalOk"], "Ceremonial otorgó la conformidad técnica")
        j.note(f"evento {event_id}")

    with j.step("Ceremonial y Técnica dan su conformidad en el mismo instante y no se pisan"):
        event_id = _create(ctx, p.administracion, ctx.agenda.free_slot(), requires_tech=data.chance(0.5))
        responses = race(status_post(p.ceremonial.s, event_id, {"to": "APROBADO"}),
                         status_post(p.tecnica.s, event_id, {"to": "APROBADO"}))
        got = codes(responses)
        ensure(got == [200, 202], f"se esperaba una respuesta 202 y otra 200; llegaron {got}")
        event = p.administracion.event(event_id)
        ensure(event["status"] == "APROBADO" and event["ceremonialOk"] and event["technicalOk"],
               f"estado final {event['status']}, OK ceremonial {event['ceremonialOk']}, OK técnico {event['technicalOk']}")
        j.note(f"evento {event_id}, códigos {got}")

    with j.step("Ninguna área retira la conformidad de la otra"):
        p.ceremonial.change_status(event_id, "EN_REVISION", technicalOk=False, expect=403)
        p.tecnica.change_status(event_id, "EN_REVISION", ceremonialOk=False, expect=403)
        event = p.administracion.event(event_id)
        ensure(event["status"] == "APROBADO" and event["ceremonialOk"] and event["technicalOk"],
               "un intento rechazado cambió el evento")

    with j.step("El perfil de consulta no cambia estados, no edita y no comenta"):
        p.consulta.change_status(event_id, "EN_REVISION", expect=403)
        p.consulta.update_event(event_id, {"name": "intento de USUARIO"}, expect=403)
        p.consulta.s.request("POST", f"/api/events/{event_id}/comments", json={"body": "x"}, expect=403)


def baja_logica(ctx: Context, j: JourneyRecorder) -> None:
    p = ctx.personas
    slot = ctx.agenda.free_slot()

    with j.step("Técnica carga un evento y lo reserva"):
        event_id = _create(ctx, p.tecnica, slot)
        p.tecnica.reserve(event_id)
        ensure(p.tecnica.availability(slot)["isAvailable"] is False, "la reserva no ocupa el espacio")

    with j.step("Ceremonial lo da de baja"):
        p.ceremonial.soft_delete(event_id)

    with j.step("La baja lo saca de la agenda interna y libera el espacio"):
        ensure(event_id not in p.consulta.active_event_ids(), "el evento dado de baja sigue en la agenda")
        on_day = p.consulta.s.json("GET", "/api/events/date", params={"date": slot.date.isoformat()})
        ensure(all(e["id"] != event_id for e in on_day), "sigue en la vista por día")
        ensure(p.tecnica.availability(slot)["isAvailable"] is True, "una baja sigue ocupando el espacio")

    with j.step("La auditoría registra la baja y quién la hizo"):
        deletions = [e for e in p.administracion.audit(event_id) if e.get("type") == "EVENT_DELETED"]
        ensure(deletions, "no hay entrada EVENT_DELETED")
        ensure((deletions[0].get("actor") or {}).get("username") == p.ceremonial.username,
               f"la baja figura a nombre de {deletions[0].get('actor')}")
