"""Lo que comparten los recorridos de una corrida: personas con sesión, catálogos, datos y agenda."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any

from agents.areas import Administracion, Ceremonial, Consulta, Tecnica
from agents.solicitante import Solicitante
from core.mailpit import Mailpit
from core.report import Report
from core.session import Session
from generators.data import DataGenerator, Slot


@dataclass
class Personas:
    solicitante: Solicitante
    ceremonial: Ceremonial
    tecnica: Tecnica
    administracion: Administracion
    consulta: Consulta


class Agenda:
    """Reparte fechas libres a los recorridos.

    Cada pedido de agenda usa un día propio, lejos de los datos de demostración, así los recorridos
    no chocan entre sí salvo cuando lo buscan. Igual se confirma con /api/availability/check, porque
    la base puede tener eventos de corridas anteriores.
    """

    def __init__(self, admin: Administracion, data: DataGenerator, spaces: list[dict[str, Any]],
                 first_day: date):
        self.admin = admin
        self.data = data
        self.spaces = spaces
        self.next_day = first_day

    def free_slot(self, *, with_space: bool = True) -> Slot:
        for _ in range(20):
            day = self.next_day
            self.next_day += timedelta(days=1)
            start, end = self.data.schedule()
            if with_space:
                space = self.data.choice(self.spaces)
                slot = Slot(day, start, end, space_id=space["id"], space_name=space["name"],
                            buffer_before=self.data.choice([0, 15, 30]), buffer_after=self.data.choice([0, 15, 30]))
            else:
                slot = Slot(day, start, end, free_location=f"Patio {self.data.choice(['Central', 'Norte', 'Sur'])}")
            if self.admin.availability(slot).get("isAvailable") is not False:
                return slot
        raise RuntimeError("no se encontró un horario libre en 20 días consecutivos")


class Context:
    def __init__(self, config: dict[str, Any], report: Report, seed: int, run_tag: str):
        api = config["api"]
        accounts = config["accounts"]
        self.config = config
        self.report = report
        self.base_url = api["base_url"]
        self.timeout = api.get("timeout", 15)
        self.password = accounts["password"]
        self.tag = run_tag
        self.data = DataGenerator(seed, config["generation"])
        self.mailpit = Mailpit(config.get("mailpit", {}).get("base_url"))

        self.personas = Personas(
            solicitante=Solicitante(self.session(None, label="solicitante")),
            ceremonial=Ceremonial(self.session(accounts["ceremonial"])),
            tecnica=Tecnica(self.session(accounts["tecnica"])),
            administracion=Administracion(self.session(accounts["administracion"])),
            consulta=Consulta(self.session(accounts["consulta"])),
        )
        self.departments: list[dict[str, Any]] = []
        self.agenda: Agenda  # Se arma en load_catalogs, antes del primer recorrido.

    def session(self, username: str | None, *, label: str | None = None) -> Session:
        return Session(self.base_url, self.report, username=username, password=self.password,
                       timeout=self.timeout, label=label)

    def sign_in_all(self) -> None:
        p = self.personas
        for staff in (p.ceremonial, p.tecnica, p.administracion, p.consulta):
            body = staff.s.login()
            if body and body.get("mustChangePassword"):
                raise RuntimeError(f"{staff.username} tiene un cambio de contraseña pendiente; el motor no lo resuelve "
                                   "por su cuenta en una cuenta semilla")
            if staff.s.user.get("role") != staff.role:
                raise RuntimeError(f"{staff.username} tiene el rol {staff.s.user.get('role')}, se esperaba {staff.role}")

    def load_catalogs(self, horizon_days: int) -> None:
        admin = self.personas.administracion
        self.departments = [d for d in admin.departments() if d.get("active")]
        spaces = [s for s in admin.spaces() if s.get("active")]
        if not self.departments or len(spaces) < 2:
            raise RuntimeError("hacen falta al menos un departamento y dos espacios activos")
        # Un desplazamiento distinto por corrida evita reutilizar días de corridas anteriores.
        offset = horizon_days + self.data.rng.randint(0, 20) * 30
        self.agenda = Agenda(admin, self.data, spaces, date.today() + timedelta(days=offset))

    def department_id(self) -> int:
        return self.data.choice(self.departments)["id"]
