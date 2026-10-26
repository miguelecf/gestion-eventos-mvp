"""Ejecuta las rondas de recorridos y escribe el informe."""
from __future__ import annotations

import random
import time
from pathlib import Path
from typing import Any

from core.report import CheckFailed, Report
from journeys import JOURNEYS, JourneyDef
from simulation.context import Context


def select(only: list[str] | None) -> list[JourneyDef]:
    if not only:
        return JOURNEYS
    known = {j.key for j in JOURNEYS}
    unknown = set(only) - known
    if unknown:
        raise RuntimeError(f"recorridos desconocidos: {', '.join(sorted(unknown))}. Disponibles: {', '.join(sorted(known))}")
    return [j for j in JOURNEYS if j.key in only]


def run(config: dict[str, Any], *, rounds: int, seed: int, only: list[str] | None, shuffle: bool,
        pause: float, report_dir: Path) -> Report:
    selected = select(only)  # Un nombre inválido se rechaza antes de iniciar sesión.
    run_tag = f"{seed:x}"[-6:]
    report = Report(config["api"]["base_url"], run_tag, seed)
    ctx = Context(config, report, seed, run_tag)

    print(f"Aplicación: {ctx.base_url} · semilla {seed} · etiqueta «{run_tag}» en los nombres generados", flush=True)
    try:
        ctx.sign_in_all()
        ctx.load_catalogs(config["generation"].get("horizon_days", 400))
    except CheckFailed as error:
        raise RuntimeError(str(error)) from error
    print(f"Mailpit: {'accesible' if ctx.mailpit.available() else 'no accesible, se omiten los pasos de correo'}",
          flush=True)

    order_rng = random.Random(seed)
    try:
        for number in range(1, rounds + 1):
            batch = [j for j in selected if number == 1 or not j.once]
            if shuffle:
                order_rng.shuffle(batch)
            for journey in batch:
                with report.journey(journey.key, journey.title, number) as recorder:
                    journey.run(ctx, recorder)
                if pause:
                    time.sleep(pause)
    finally:
        # También ante Ctrl+C: lo verificado hasta ahí queda en el informe.
        json_path, md_path = report.write(report_dir)
    print("\n" + "\n".join(report.summary_lines()))
    print(f"Informe: {md_path}\nDetalle: {json_path}")
    return report
