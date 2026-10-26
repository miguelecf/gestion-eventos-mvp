"""Motor de usuarios sintéticos para Gestión de Eventos.

Personas sintéticas (un solicitante sin cuenta, Ceremonial, Técnica, Administración y un perfil de
consulta) recorren la aplicación por HTTP como lo haría la interfaz, y cada paso verifica la regla de
negocio que corresponde. Deja datos realistas en la base y un informe de lo que pasó.

Uso:
    python main.py                        # una ronda de todos los recorridos contra :8080
    python main.py --rounds 5             # cinco rondas, para poblar la agenda
    python main.py --only solicitud_aprobada prioridad_rectorado
    python main.py --list
"""
from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from journeys import JOURNEYS  # noqa: E402
from simulation import runner  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Recorre la aplicación con personas sintéticas y verifica cada paso.")
    parser.add_argument("--config", default=str(ROOT / "config.yaml"), help="archivo de configuración")
    parser.add_argument("--base-url", help="URL de la aplicación (pisa api.base_url y ENGINE_BASE_URL)")
    parser.add_argument("--mailpit-url", help="URL de Mailpit para los pasos que leen correo")
    parser.add_argument("--rounds", type=int, default=1, help="rondas de recorridos (por defecto 1)")
    parser.add_argument("--seed", type=int, help="semilla; repetirla repite datos y decisiones")
    parser.add_argument("--only", nargs="+", metavar="RECORRIDO", help="ejecuta solo estos recorridos")
    parser.add_argument("--shuffle", action="store_true", help="mezcla el orden de los recorridos en cada ronda")
    parser.add_argument("--pause", type=float, default=0.0, help="segundos de espera entre recorridos")
    parser.add_argument("--list", action="store_true", help="lista los recorridos y termina")
    args = parser.parse_args()

    if args.list:
        for journey in JOURNEYS:
            print(f"{journey.key:<24} {journey.title}{' (solo en la primera ronda)' if journey.once else ''}")
        return 0

    config = yaml.safe_load(Path(args.config).read_text(encoding="utf-8"))
    config["api"]["base_url"] = args.base_url or os.environ.get("ENGINE_BASE_URL") or config["api"]["base_url"]
    mailpit = args.mailpit_url or os.environ.get("ENGINE_MAILPIT_URL")
    if mailpit:
        config.setdefault("mailpit", {})["base_url"] = mailpit
    config["accounts"]["password"] = os.environ.get("ENGINE_PASSWORD", config["accounts"]["password"])

    seed = args.seed if args.seed is not None else int(time.time())
    try:
        report = runner.run(config, rounds=args.rounds, seed=seed, only=args.only, shuffle=args.shuffle,
                            pause=args.pause, report_dir=ROOT / "reports")
    except RuntimeError as error:
        print(f"No se pudo preparar la corrida: {error}", file=sys.stderr)
        return 2
    return 1 if report.failed or report.server_errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
