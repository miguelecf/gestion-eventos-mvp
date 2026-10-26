"""Datos verosímiles para solicitudes, eventos, comentarios y cuentas.

Todo sale de un único generador con semilla: la misma semilla repite los mismos nombres, fechas y
decisiones. Los valores de enumeración son los del contrato vigente del backend.
"""
from __future__ import annotations

import random
from datetime import date, time
from typing import Any

from faker import Faker

AUDIENCES = ["ESTUDIANTES", "DOCENTES", "AUTORIDADES", "COMUNIDAD", "TERCERA_EDAD"]
TECH_MODES = ["SETUP_ONLY", "ATTENDED"]


class DataGenerator:
    def __init__(self, seed: int, config: dict[str, Any]):
        self.rng = random.Random(seed)
        self.fake = Faker(config.get("locale", "es_AR"))
        self.fake.seed_instance(seed)
        self.event_types: list[str] = config["event_types"]
        self.topics: list[str] = config["topics"]
        self.areas: list[str] = config["requesting_areas"]
        self.requirements: list[str] = config["requirements"]
        self.comments: dict[str, list[str]] = config["comments"]
        self.rejection_reasons: list[str] = config["rejection_reasons"]

    def chance(self, probability: float) -> bool:
        return self.rng.random() < probability

    def choice(self, options: list[Any]) -> Any:
        return self.rng.choice(options)

    def event_name(self, tag: str) -> str:
        # La etiqueta de corrida permite encontrar en la app lo que generó cada ejecución.
        return f"{self.choice(self.event_types)} {self.choice(self.topics)} · {tag}"

    def contact(self) -> dict[str, str]:
        first, last = self.fake.first_name(), self.fake.last_name()
        user = f"{first}.{last}".lower().replace(" ", "")
        return {
            "contactName": f"{first} {last}",
            # Dominio reservado: nunca sale correo a una dirección real.
            "contactEmail": f"{strip_accents(user)}.{self.rng.randint(100, 999)}@example.test",
            "contactPhone": f"+54 11 {self.rng.randint(4000, 6999)}-{self.rng.randint(1000, 9999)}",
        }

    def schedule(self) -> tuple[time, time]:
        start = time(self.rng.randint(9, 17), self.choice([0, 30]))
        minutes = self.choice([60, 90, 120, 180])
        end_minutes = min(start.hour * 60 + start.minute + minutes, 21 * 60 + 30)
        return start, time(end_minutes // 60, end_minutes % 60)

    def public_request(self, slot: "Slot", tag: str, department_id: int | None) -> dict[str, Any]:
        body: dict[str, Any] = {
            "date": slot.date.isoformat(),
            "scheduleFrom": hhmm(slot.start),
            "scheduleTo": hhmm(slot.end),
            "name": self.event_name(tag),
            "requirements": self.choice(self.requirements),
            "coverage": f"{self.rng.randint(2, 40) * 10} personas",
            "observations": self.fake.sentence(nb_words=10) if self.chance(0.5) else None,
            "audienceType": self.choice(AUDIENCES),
            "bufferBeforeMin": slot.buffer_before,
            "bufferAfterMin": slot.buffer_after,
            **self.contact(),
        }
        if slot.space_id is not None:
            body["space_id"] = slot.space_id
        else:
            body["free_location"] = slot.free_location
        if department_id is not None:
            body["requesting_department_id"] = department_id
        return body

    def internal_event(self, slot: "Slot", tag: str, department_id: int, *, area: str | None = None,
                       priority: str = "MEDIUM", requires_tech: bool = False) -> dict[str, Any]:
        body: dict[str, Any] = {
            "date": slot.date.isoformat(),
            "scheduleFrom": hhmm(slot.start),
            "scheduleTo": hhmm(slot.end),
            "departmentId": department_id,
            "name": self.event_name(tag),
            "requestingArea": area or self.choice(self.areas),
            "requirements": self.choice(self.requirements),
            "coverage": f"{self.rng.randint(2, 40) * 10} personas",
            "priority": priority,
            "audienceType": self.choice(AUDIENCES),
            "internal": self.chance(0.3),
            "requiresTech": requires_tech,
            "techSupportMode": self.choice(TECH_MODES) if requires_tech else None,
            "bufferBeforeMin": slot.buffer_before,
            "bufferAfterMin": slot.buffer_after,
            **self.contact(),
        }
        if slot.space_id is not None:
            body["spaceId"] = slot.space_id
        else:
            body["freeLocation"] = slot.free_location
        return body

    def comment(self, area: str) -> str:
        return self.choice(self.comments[area])

    def rejection_reason(self) -> str:
        return self.choice(self.rejection_reasons)

    def account(self, nonce: str) -> dict[str, Any]:
        first, last = self.fake.first_name(), self.fake.last_name()
        username = strip_accents(f"sint.{first}.{last}".lower().replace(" ", ""))[:40] + f".{nonce}"
        return {
            "username": username,
            "email": f"{username}@example.test",
            "name": first,
            "lastName": last,
            "role": "USUARIO",
            "priority": "LOW",
            "active": True,
        }

    def strong_password(self) -> str:
        return f"Sintetica{self.rng.randint(1000, 9999)}x{self.rng.randint(10, 99)}"


class Slot:
    """Fecha, horario y lugar de un evento. Sin espacio, usa una ubicación libre."""

    def __init__(self, day: date, start: time, end: time, *, space_id: int | None = None,
                 space_name: str | None = None, free_location: str | None = None,
                 buffer_before: int = 0, buffer_after: int = 0):
        self.date = day
        self.start = start
        self.end = end
        self.space_id = space_id
        self.space_name = space_name
        self.free_location = free_location
        self.buffer_before = buffer_before
        self.buffer_after = buffer_after

    def __str__(self) -> str:
        where = self.space_name or self.free_location or f"espacio {self.space_id}"
        return f"{self.date} {hhmm(self.start)}–{hhmm(self.end)} en {where}"


def hhmm(value: time) -> str:
    return value.strftime("%H:%M")


def strip_accents(text: str) -> str:
    table = str.maketrans("áéíóúüñÁÉÍÓÚÜÑ", "aeiouunAEIOUUN")
    return "".join(ch for ch in text.translate(table) if ch.isalnum() or ch in "._-")
