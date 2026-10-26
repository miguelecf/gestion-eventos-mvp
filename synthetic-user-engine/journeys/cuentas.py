"""Ciclo de vida de una cuenta interna: alta, primer ingreso, cambio de rol, intentos fallidos y baja.

Solo toca cuentas que crea el propio motor; nunca las cuentas semilla.
"""
from __future__ import annotations

import uuid

from agents.staff import Staff
from core.report import JourneyRecorder, ensure
from simulation.context import Context


def alta_de_cuenta(ctx: Context, j: JourneyRecorder) -> None:
    p, data = ctx.personas, ctx.data
    # Un nombre de usuario no puede repetirse, aunque se repita la semilla.
    body = data.account(uuid.uuid4().hex[:6])
    person = Staff(ctx.session(body["username"]))

    with j.step("Administración da de alta una cuenta de consulta"):
        created = p.administracion.create_account(body)
        user_id = created["id"]
        ensure(created["role"] == "USUARIO" and created["active"], f"cuenta creada: {created}")
        j.note(f"{body['username']} (id {user_id})")

    with j.step("Otros perfiles no administran cuentas"):
        p.ceremonial.s.request("GET", "/api/users", expect=403)
        p.consulta.s.request("PATCH", f"/api/users/{user_id}/role", json={"role": "ADMIN_FULL"}, expect=403)

    mail_ok = ctx.mailpit.available()
    if not mail_ok:
        j.skip("La persona entra con la clave del correo y la cambia",
               "Mailpit no está accesible (levantar con docker-compose.mail-access.yml o pasar --mailpit-url)")
    else:
        with j.step("La persona entra con la clave del correo y la cambia"):
            temporary = ctx.mailpit.temporary_password(body["email"])
            ensure(temporary is not None, f"no llegó el correo de alta a {body['email']}")
            login = person.s.login(temporary)
            ensure(login.get("mustChangePassword") is True and not login.get("refreshToken"),
                   "el primer ingreso no exige cambiar la contraseña")
            person.s.request("GET", "/api/events", expect=(401, 403), retry_on_401=False)
            person.s.request("POST", "/auth/change-password", expect=400,
                             json={"currentPassword": temporary, "newPassword": "corta1"})
            final = data.strong_password()
            person.s.request("POST", "/auth/change-password", expect=(200, 204),
                             json={"currentPassword": temporary, "newPassword": final})
            person.s.login(final)
            ensure(not person.s.must_change_password, "sigue pidiendo cambio de contraseña")
            person.s.request("GET", "/api/events", expect=200)

    with j.step("Un intento con clave equivocada responde 401 y suma un intento fallido"):
        wrong = ctx.session(body["username"], label=f"{body['username']} (clave errónea)")
        before = p.administracion.account(user_id)["failedLoginAttempts"]
        wrong.login("no-es-la-clave-1", expect=401)
        ensure(p.administracion.account(user_id)["failedLoginAttempts"] == before + 1, "el intento no se contó")

    with j.step("Administración la pasa a Técnica y el cambio rige sin volver a iniciar sesión"):
        p.administracion.set_role(user_id, "ADMIN_TECNICA")
        if mail_ok:
            person.s.request("GET", "/api/tech/capacity", params={"date": ctx.agenda.next_day.isoformat()}, expect=200)
            person.s.request("GET", "/api/users", expect=403)
        else:
            j.note("sin sesión de la persona: solo se verifica el registro")

    with j.step("La baja corta la sesión abierta y bloquea el ingreso"):
        p.administracion.set_active(user_id, False)
        if mail_ok:
            person.s.request("GET", "/api/events", expect=401, retry_on_401=False)
            person.s.login(expect=423)

    with j.step("El historial de la cuenta registra cada acción y su autor"):
        history = p.administracion.account_history(user_id)
        actions = [h["action"] for h in history]
        for expected in ("CREATED", "ROLE_CHANGED", "STATUS_CHANGED"):
            ensure(expected in actions, f"falta {expected} en el historial: {actions}")
        ensure(all(h["actorUsername"] == p.administracion.username for h in history if h["action"] != "UPDATED"),
               f"autores: {[h['actorUsername'] for h in history]}")
