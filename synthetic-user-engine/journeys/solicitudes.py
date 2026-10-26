"""Recorridos de una solicitud pública: de la carga sin cuenta hasta el calendario o el rechazo."""
from __future__ import annotations

from core.report import JourneyRecorder, ensure
from generators.data import hhmm
from journeys.common import codes, race
from simulation.context import Context

REJECTED_4XX = (400, 409)


def solicitud_aprobada(ctx: Context, j: JourneyRecorder) -> None:
    p, data = ctx.personas, ctx.data
    slot = ctx.agenda.free_slot()

    with j.step("El solicitante consulta los espacios y la disponibilidad del horario"):
        names = {s["name"] for s in p.solicitante.public_spaces()}
        ensure(slot.space_name in names, f"el espacio {slot.space_name} no figura en el catálogo público")
        check = p.solicitante.check_availability(slot)
        ensure(check.get("isAvailable") is True, f"el horario libre figura ocupado: {check}")
        j.note(str(slot))

    body = data.public_request(slot, ctx.tag, ctx.department_id())
    with j.step("Envía la solicitud sin cuenta y recibe un código de seguimiento"):
        uuid = p.solicitante.submit(body)
        tracking = p.solicitante.track(uuid, contact_email=body["contactEmail"])
        ensure(tracking["request"]["status"] == "RECIBIDO", f"seguimiento: {tracking['request']}")
        ensure(tracking["schedule"] == {"date": body["date"], "from": body["scheduleFrom"], "to": body["scheduleTo"]},
               f"el seguimiento muestra otra agenda: {tracking['schedule']}")

    reviewer = data.choice([p.ceremonial, p.tecnica, p.administracion])
    with j.step(f"{reviewer.username} la encuentra en la bandeja y la pone en revisión"):
        request = reviewer.find_request(uuid)
        ensure(request["status"] == "RECIBIDO", f"la bandeja la muestra en {request['status']}")
        reviewer.request_to_review(request["id"])
        ensure(p.solicitante.track(uuid)["request"]["status"] == "EN_REVISION", "el seguimiento no refleja la revisión")

    converter = data.choice([p.ceremonial, p.tecnica, p.administracion])
    requires_tech = data.chance(0.6)
    mode = data.choice(["SETUP_ONLY", "ATTENDED"]) if requires_tech else None
    with j.step(f"{converter.username} la convierte en evento"):
        event = converter.convert(request["id"], requires_tech=requires_tech, mode=mode)
        ensure(event["status"] == "EN_REVISION", f"convertir no equivale a aprobar, pero quedó {event['status']}")
        ensure(event["priority"] == "MEDIUM", f"la solicitud pública no elige prioridad, pero quedó {event['priority']}")
        ensure(event["originType"] == "PUBLIC_REQUEST" and event["originRequestId"] == request["id"],
               f"el evento no conserva su origen: {event['originType']} {event['originRequestId']}")
        ensure(event["requiresTech"] is requires_tech, "la necesidad técnica no es la decidida al convertir")
        tracking = p.solicitante.track(uuid)
        ensure(tracking["request"]["status"] == "CONVERTIDO" and tracking["event"] == {"status": "EN_REVISION"},
               f"seguimiento tras convertir: {tracking['request']} {tracking['event']}")
        event_id = event["id"]
        j.note(f"evento {event_id}{', con soporte técnico ' + mode if requires_tech else ''}")

    with j.step("Una segunda conversión de la misma solicitud se rechaza"):
        converter.convert(request["id"], requires_tech=False, mode=None, expect=REJECTED_4XX)

    with j.step("Las áreas coordinan con comentarios que el solicitante no ve"):
        texts = [p.ceremonial.comment(event_id, data.comment("ceremonial"))["body"],
                 p.tecnica.comment(event_id, data.comment("tecnica"))["body"]]
        raw = p.solicitante.s.request("GET", f"/public/track/{uuid}", auth=False, expect=200).text
        ensure(not any(text in raw for text in texts), "un comentario interno aparece en el seguimiento público")
        p.consulta.s.request("GET", f"/api/events/{event_id}/comments", expect=403)

    with j.step("Ceremonial da su conformidad y el evento espera la de Técnica"):
        result = p.ceremonial.give_ok(event_id, expect=202)
        ensure(result["approvalPending"] is True and result["status"] != "APROBADO", f"respuesta: {result}")
        ensure(p.ceremonial.event(event_id)["ceremonialOk"] is True, "la conformidad ceremonial no quedó registrada")

    with j.step("Técnica revisa la capacidad del día y da su conformidad"):
        before = p.tecnica.capacity(slot.date.isoformat()) if requires_tech else None
        result = p.tecnica.give_ok(event_id, expect=200)
        ensure(result["status"] == "APROBADO" and result["approvalPending"] is False, f"respuesta: {result}")
        if before is not None:
            after = p.tecnica.capacity(slot.date.isoformat())
            grown = [b["from"] for b, a in zip(before["blocks"], after["blocks"]) if a["used"] > b["used"]]
            # ATTENDED ocupa el evento completo con sus márgenes; SETUP_ONLY, solo el armado y el desarme.
            consumes = mode == "ATTENDED" or slot.buffer_before > 0 or slot.buffer_after > 0
            if consumes:
                ensure(grown, "la capacidad técnica no descuenta el evento aprobado")
            else:
                ensure(not grown, f"un SETUP_ONLY sin márgenes consumió los bloques {grown}")
            j.note(f"bloques técnicos consumidos: {', '.join(grown) or 'ninguno'}")

    with j.step("El evento aparece en el calendario público sin datos de contacto"):
        res = p.solicitante.s.request("GET", "/public/events", auth=False, expect=200)
        ensure(any(e["id"] == event_id for e in res.json()), "el evento aprobado no está en el calendario público")
        ensure(body["contactEmail"] not in res.text and body["contactPhone"] not in res.text,
               "el calendario público expone el contacto del solicitante")

    with j.step("El solicitante ve su pedido aprobado y la historia queda firmada"):
        tracking = p.solicitante.track(uuid)
        ensure(tracking["event"] == {"status": "APROBADO"}, f"seguimiento final: {tracking['event']}")
        actors = {(e.get("actor") or {}).get("username") for e in p.administracion.request_history(request["id"])}
        ensure({reviewer.username, converter.username} <= actors,
               f"el historial de la solicitud no firma a quienes actuaron: {actors}")
        approvals = [e for e in p.administracion.audit(event_id) if e.get("type") == "STATUS" and e.get("toValue") == "APROBADO"]
        ensure(approvals, "la auditoría del evento no registra la aprobación")


def solicitud_rechazada(ctx: Context, j: JourneyRecorder) -> None:
    p, data = ctx.personas, ctx.data
    slot = ctx.agenda.free_slot(with_space=data.chance(0.6))
    body = data.public_request(slot, ctx.tag, ctx.department_id())

    with j.step("El solicitante envía la solicitud"):
        uuid = p.solicitante.submit(body)
        request = p.ceremonial.find_request(uuid)
        j.note(str(slot))

    with j.step("Rechazar sin motivo no se permite"):
        p.ceremonial.reject_request(request["id"], None, expect=400)

    reason = data.rejection_reason()
    with j.step("Ceremonial la rechaza con un motivo"):
        result = p.ceremonial.reject_request(request["id"], reason)
        ensure(result["status"] == "RECHAZADO", f"la solicitud quedó {result['status']}")

    with j.step("El solicitante ve el rechazo y su motivo"):
        tracking = p.solicitante.track(uuid, contact_email=body["contactEmail"])
        ensure(tracking["request"]["status"] == "RECHAZADO", f"seguimiento: {tracking['request']}")
        ensure(tracking.get("rejectionReason") == reason, f"motivo publicado: {tracking.get('rejectionReason')!r}")

    with j.step("Una solicitud rechazada no vuelve a revisión ni se convierte"):
        p.tecnica.s.request("PATCH", f"/admin/event-requests/{request['id']}/status",
                            json={"newStatus": "EN_REVISION"}, expect=REJECTED_4XX)
        p.tecnica.convert(request["id"], requires_tech=False, mode=None, expect=REJECTED_4XX)


def conversion_simultanea(ctx: Context, j: JourneyRecorder) -> None:
    p, data = ctx.personas, ctx.data
    slot = ctx.agenda.free_slot()
    body = data.public_request(slot, ctx.tag, ctx.department_id())

    with j.step("Llega una solicitud y Administración la pone en revisión"):
        uuid = p.solicitante.submit(body)
        request = p.administracion.find_request(uuid)
        p.administracion.request_to_review(request["id"])

    path = f"/admin/event-requests/{request['id']}/convert-to-event"
    with j.step("Ceremonial y Técnica la convierten en el mismo instante: gana una sola"):
        responses = race(lambda: p.ceremonial.s.request("POST", path, json={"requiresTech": False}),
                         lambda: p.tecnica.s.request("POST", path, json={"requiresTech": False}))
        got = codes(responses)
        ensure(got[0] == 200 and got[1] in REJECTED_4XX, f"códigos obtenidos: {got}")
        j.note(f"códigos {got}")

    with j.step("Queda un único evento para esa solicitud"):
        on_day = p.administracion.s.json("GET", "/api/events/date", params={"date": slot.date.isoformat()})
        same = [e for e in on_day if e["name"] == body["name"]]
        ensure(len(same) == 1, f"la solicitud generó {len(same)} eventos")
        event = p.administracion.event(same[0]["id"])
        ensure(event["originRequestId"] == request["id"], f"el evento apunta a la solicitud {event['originRequestId']}")
        ensure(event["scheduleFrom"] == hhmm(slot.start), "el evento no respeta la agenda pedida")
        ensure(p.solicitante.track(uuid)["request"]["status"] == "CONVERTIDO", "la solicitud no quedó CONVERTIDO")
