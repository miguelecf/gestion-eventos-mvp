"""La matriz de permisos vista desde afuera.

Lee la misma matriz que usan la interfaz y los tests (frontend/src/libs/permisos.json) y la prueba
por HTTP con cada perfil: lo que un rol no tiene debe responder 401 sin sesión o 403 con sesión, y
las lecturas que sí tiene no deben rechazarse por permisos. Nunca ejecuta una escritura permitida:
solo comprueba que las prohibidas se rechazan, y lo hace con cuerpo vacío.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from core.report import JourneyRecorder, ensure
from core.session import Session
from simulation.context import Context

MATRIX = Path(__file__).resolve().parents[2] / "frontend" / "src" / "libs" / "permisos.json"
# Valores para rutas y parámetros obligatorios. Un id inexistente alcanza: la autorización se
# resuelve antes de buscar el recurso.
PATH_VALUES = {"id": "999999", "eventId": "999999", "commentId": "999999", "spaceId": "999999",
               "trackingUuid": "00000000-0000-0000-0000-000000000000", "userId": "999999",
               "priority": "MEDIUM", "status": "EN_REVISION"}
READ_PARAMS = {"/api/events/date": {"date": "2030-01-01"},
               "/api/events/range": {"start": "2030-01-01", "end": "2030-01-31"},
               "/api/tech/capacity": {"date": "2030-01-01"}, "/api/tech/events": {"date": "2030-01-01"},
               "/api/priority/conflicts": {"eventId": "999999"}}


def _endpoints(matrix: dict[str, Any]) -> list[tuple[str, str, set[str] | None]]:
    rows = []
    for permission in matrix["permissions"]:
        roles = None if permission.get("public") else set(permission.get("roles", []))
        for endpoint in permission["endpoints"]:
            method, path = endpoint.split(" ", 1)
            rows.append((method, path, roles))
    return rows


def _concrete(path: str) -> str:
    return re.sub(r"\{(\w+)\}", lambda m: PATH_VALUES[m.group(1)], path)


def _call(session: Session, method: str, path: str, *, auth: bool):
    kwargs: dict[str, Any] = {"auth": auth, "retry_on_401": False}
    if method == "GET":
        kwargs["params"] = READ_PARAMS.get(path)
    else:
        kwargs["json"] = {}
    return session.request(method, _concrete(path), **kwargs)


def matriz_de_permisos(ctx: Context, j: JourneyRecorder) -> None:
    p = ctx.personas
    matrix = json.loads(MATRIX.read_text(encoding="utf-8"))
    endpoints = _endpoints(matrix)
    staff = {"USUARIO": p.consulta, "ADMIN_CEREMONIAL": p.ceremonial,
             "ADMIN_TECNICA": p.tecnica, "ADMIN_FULL": p.administracion}

    with j.step("Sin sesión, todo lo interno responde 401"):
        anonymous = ctx.session(None, label="anónimo")
        wrong = [f"{m} {path} → {_call(anonymous, m, path, auth=False).status_code}"
                 for m, path, roles in endpoints if roles is not None]
        wrong = [w for w in wrong if not w.endswith("401")]
        ensure(not wrong, "respuestas distintas de 401: " + "; ".join(wrong))

    for role, persona in staff.items():
        with j.step(f"{role}: lo que no le corresponde responde 403"):
            denied = [(m, path) for m, path, roles in endpoints if roles is not None and role not in roles]
            wrong = [f"{m} {path} → {code}" for m, path in denied
                     if (code := _call(persona.s, m, path, auth=True).status_code) != 403]
            ensure(not wrong, "respuestas distintas de 403: " + "; ".join(wrong))
            j.note(f"{len(denied)} operaciones prohibidas")

        with j.step(f"{role}: sus lecturas no se rechazan por permisos"):
            reads = [path for m, path, roles in endpoints
                     if m == "GET" and roles is not None and role in roles]
            wrong = [f"GET {path} → {code}" for path in reads
                     if (code := _call(persona.s, "GET", path, auth=True).status_code) in (401, 403)]
            ensure(not wrong, "lecturas rechazadas: " + "; ".join(wrong))
            j.note(f"{len(reads)} lecturas")
