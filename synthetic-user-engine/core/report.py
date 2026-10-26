"""Registro de recorridos, pasos y llamadas HTTP, y escritura del informe en JSON y Markdown."""
from __future__ import annotations

import json
from collections import Counter
from contextlib import contextmanager
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
import time
from typing import Iterator

PASS, FAIL, SKIP = "PASS", "FAIL", "SKIP"
SYMBOL = {PASS: "✔", FAIL: "✘", SKIP: "–"}


class CheckFailed(AssertionError):
    """La aplicación respondió distinto de lo que la regla de negocio exige."""


class JourneyStop(Exception):
    """Corta el recorrido: los pasos siguientes dependen del que falló."""


def ensure(condition: bool, message: str) -> None:
    if not condition:
        raise CheckFailed(message)


@dataclass
class Step:
    name: str
    outcome: str
    detail: str = ""
    seconds: float = 0.0


@dataclass
class Journey:
    key: str
    title: str
    round: int
    steps: list[Step] = field(default_factory=list)
    outcome: str = PASS
    seconds: float = 0.0


@dataclass
class Call:
    persona: str
    method: str
    path: str
    status: int | None
    seconds: float


class JourneyRecorder:
    def __init__(self, journey: Journey, echo: bool):
        self.journey = journey
        self.echo = echo
        self._notes: list[str] = []

    @contextmanager
    def step(self, name: str) -> Iterator[None]:
        self._notes = []
        started = time.monotonic()
        try:
            yield
        except CheckFailed as error:
            self._record(name, FAIL, str(error), started)
            raise JourneyStop from error
        except JourneyStop:
            raise
        except Exception as error:  # Un error del propio motor también corta el recorrido, pero se distingue.
            self._record(name, FAIL, f"error inesperado del motor: {type(error).__name__}: {error}", started)
            raise JourneyStop from error
        self._record(name, PASS, "; ".join(self._notes), started)

    def note(self, text: str) -> None:
        self._notes.append(text)

    def skip(self, name: str, reason: str) -> None:
        self._record(name, SKIP, reason, time.monotonic())

    def _record(self, name: str, outcome: str, detail: str, started: float) -> None:
        step = Step(name, outcome, detail, round(time.monotonic() - started, 3))
        self.journey.steps.append(step)
        if outcome == FAIL:
            self.journey.outcome = FAIL
        if self.echo:
            line = f"    {SYMBOL[outcome]} {name}"
            if detail and outcome != PASS:
                line += f" — {detail}"
            print(line, flush=True)


class Report:
    def __init__(self, base_url: str, run_id: str, seed: int, echo: bool = True):
        self.base_url = base_url
        self.run_id = run_id
        self.seed = seed
        self.echo = echo
        self.started_at = datetime.now()
        self.finished_at: datetime | None = None
        self.journeys: list[Journey] = []
        self.calls: list[Call] = []

    def trace(self, persona: str, method: str, path: str, status: int | None, seconds: float) -> None:
        self.calls.append(Call(persona, method, path, status, round(seconds, 4)))

    @contextmanager
    def journey(self, key: str, title: str, round_number: int) -> Iterator[JourneyRecorder]:
        journey = Journey(key, title, round_number)
        self.journeys.append(journey)
        if self.echo:
            print(f"\n[{round_number}] {title}", flush=True)
        started = time.monotonic()
        recorder = JourneyRecorder(journey, self.echo)
        try:
            yield recorder
        except JourneyStop:
            pass
        except Exception as error:  # Fuera de un paso (por ejemplo, al buscar agenda): se registra y se sigue.
            recorder._record("Preparación del recorrido", FAIL, f"{type(error).__name__}: {error}", started)
        finally:
            journey.seconds = round(time.monotonic() - started, 3)

    # -- resumen -------------------------------------------------------------------------------

    @property
    def failed(self) -> list[Journey]:
        return [j for j in self.journeys if j.outcome == FAIL]

    @property
    def server_errors(self) -> list[Call]:
        return [c for c in self.calls if c.status is None or c.status >= 500]

    def summary_lines(self) -> list[str]:
        steps = [s for j in self.journeys for s in j.steps]
        counts = Counter(s.outcome for s in steps)
        return [
            f"Recorridos: {len(self.journeys)} ({len(self.journeys) - len(self.failed)} sin fallas, {len(self.failed)} con fallas)",
            f"Pasos: {counts[PASS]} ok, {counts[FAIL]} con falla, {counts[SKIP]} omitidos",
            f"Llamadas HTTP: {len(self.calls)}; errores del servidor (5xx o sin respuesta): {len(self.server_errors)}",
        ]

    def write(self, directory: Path) -> tuple[Path, Path]:
        self.finished_at = datetime.now()
        directory.mkdir(parents=True, exist_ok=True)
        stem = f"{self.started_at:%Y%m%d-%H%M%S}-{self.run_id}"
        json_path = directory / f"{stem}.json"
        md_path = directory / f"{stem}.md"
        json_path.write_text(json.dumps({
            "base_url": self.base_url,
            "run_id": self.run_id,
            "seed": self.seed,
            "started_at": self.started_at.isoformat(timespec="seconds"),
            "finished_at": self.finished_at.isoformat(timespec="seconds"),
            "journeys": [asdict(j) for j in self.journeys],
            "calls": [asdict(c) for c in self.calls],
        }, ensure_ascii=False, indent=2), encoding="utf-8")
        md_path.write_text(self._markdown(), encoding="utf-8")
        return json_path, md_path

    def _markdown(self) -> str:
        out = [
            "# Informe del motor de usuarios sintéticos",
            "",
            f"- Aplicación: `{self.base_url}`",
            f"- Corrida: `{self.run_id}` · semilla `{self.seed}`",
            f"- Inicio: {self.started_at:%Y-%m-%d %H:%M:%S} · fin: {self.finished_at:%Y-%m-%d %H:%M:%S}",
            "",
            *[f"- {line}" for line in self.summary_lines()],
            "",
            "## Recorridos",
            "",
            "| Ronda | Recorrido | Resultado | Pasos | Segundos |",
            "|---:|---|:---:|---:|---:|",
        ]
        for j in self.journeys:
            out.append(f"| {j.round} | {j.title} | {SYMBOL[j.outcome]} {j.outcome} | {len(j.steps)} | {j.seconds:.1f} |")

        if self.failed:
            out += ["", "## Fallas", ""]
            for j in self.failed:
                for s in j.steps:
                    if s.outcome == FAIL:
                        out += [f"### [{j.round}] {j.title}", "", f"**Paso:** {s.name}", "", f"```text\n{s.detail}\n```", ""]

        skipped = [(j, s) for j in self.journeys for s in j.steps if s.outcome == SKIP]
        if skipped:
            out += ["", "## Pasos omitidos", ""]
            out += [f"- [{j.round}] {j.title} → {s.name}: {s.detail}" for j, s in skipped]

        out += ["", "## Tráfico HTTP", "", "| Persona | Llamadas | 2xx | 4xx | 5xx |", "|---|---:|---:|---:|---:|"]
        by_persona: dict[str, Counter] = {}
        for c in self.calls:
            bucket = "5xx" if c.status is None or c.status >= 500 else f"{c.status // 100}xx"
            by_persona.setdefault(c.persona, Counter())[bucket] += 1
        for persona, counter in sorted(by_persona.items()):
            total = sum(counter.values())
            out.append(f"| {persona} | {total} | {counter['2xx']} | {counter['4xx']} | {counter['5xx']} |")
        slowest = sorted(self.calls, key=lambda c: c.seconds, reverse=True)[:5]
        if slowest:
            out += ["", "Llamadas más lentas:", ""]
            out += [f"- {c.seconds * 1000:.0f} ms · {c.persona} · `{c.method} {c.path}` → {c.status}" for c in slowest]
        if self.server_errors:
            out += ["", "Errores del servidor:", ""]
            out += [f"- {c.persona} · `{c.method} {c.path}` → {c.status or 'sin respuesta'}" for c in self.server_errors]
        out.append("")
        return "\n".join(out)
