"""Las tres áreas internas y el perfil de consulta, cada uno con lo que solo él hace."""
from __future__ import annotations

from typing import Any, Iterable

from agents.staff import Staff
from core.report import ensure


class Ceremonial(Staff):
    role = "ADMIN_CEREMONIAL"
    comment_area = "ceremonial"

    def give_ok(self, event_id: int, *, expect: int | Iterable[int] = (200, 202)) -> Any:
        return self.change_status(event_id, "APROBADO", ceremonialOk=True, expect=expect)

    def pending_conflicts(self) -> list[dict[str, Any]]:
        page = self.s.json("GET", "/api/priority/conflicts/pending", params={"size": 100})
        return page.get("content") or []

    def decide(self, conflict_id: str, decision: str, *, target: dict[str, Any] | None = None,
               reason: str | None = None, expect: int | Iterable[int] = 200) -> Any:
        body: dict[str, Any] = {"conflictId": conflict_id, "decision": decision, "reason": reason}
        if target is not None:
            body["target"] = target
        res = self.s.request("POST", "/api/priority/decisions", json=body, expect=expect)
        return res.json() if res.content else None


class Tecnica(Staff):
    role = "ADMIN_TECNICA"
    comment_area = "tecnica"

    def give_ok(self, event_id: int, *, expect: int | Iterable[int] = (200, 202)) -> Any:
        return self.change_status(event_id, "APROBADO", technicalOk=True, expect=expect)

    def capacity(self, day: str) -> dict[str, Any]:
        result = self.s.json("GET", "/api/tech/capacity", params={"date": day})
        blocks = result.get("blocks") or []
        ensure(blocks, f"la capacidad técnica del {day} no tiene bloques")
        ensure(all(b["available"] >= 0 for b in blocks), f"un bloque informa más uso que cupo: {blocks}")
        return result


class Administracion(Ceremonial):
    """ADMIN_FULL: puede todo lo de Ceremonial y Técnica, y además administra cuentas."""
    role = "ADMIN_FULL"
    comment_area = "administracion"

    def give_both_oks(self, event_id: int, *, expect: int | Iterable[int] = 200) -> Any:
        return self.change_status(event_id, "APROBADO", ceremonialOk=True, technicalOk=True, expect=expect)

    def departments(self) -> list[dict[str, Any]]:
        return self.s.json("GET", "/api/catalogs/departments", params={"size": 100}).get("content") or []

    def spaces(self) -> list[dict[str, Any]]:
        return self.s.json("GET", "/api/catalogs/spaces", params={"size": 100}).get("content") or []

    def create_account(self, body: dict[str, Any]) -> dict[str, Any]:
        created = self.s.json("POST", "/api/users", json=body, expect=201)
        ensure(created.get("mustChangePassword") is True, f"la cuenta nueva no exige cambiar la contraseña: {created}")
        return created

    def account(self, user_id: int) -> dict[str, Any]:
        return self.s.json("GET", f"/api/users/{user_id}")

    def set_role(self, user_id: int, role: str) -> dict[str, Any]:
        return self.s.json("PATCH", f"/api/users/{user_id}/role", json={"role": role})

    def set_active(self, user_id: int, active: bool) -> dict[str, Any]:
        return self.s.json("PATCH", f"/api/users/{user_id}/status", json={"active": active})

    def account_history(self, user_id: int) -> list[dict[str, Any]]:
        return self.s.json("GET", f"/api/users/{user_id}/history")


class Consulta(Staff):
    """USUARIO: solo lectura de la agenda interna."""
    role = "USUARIO"
