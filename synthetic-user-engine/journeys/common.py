"""Ayudas que usan varios recorridos."""
from __future__ import annotations

import threading
from datetime import datetime, time, timedelta
from typing import Any, Callable

import requests

from core.report import ensure
from core.session import Session


def race(*calls: Callable[[], requests.Response]) -> list[requests.Response]:
    """Lanza los pedidos a la vez, como dos personas que aprietan el botón en el mismo instante."""
    barrier = threading.Barrier(len(calls))
    results: list[Any] = [None] * len(calls)

    def worker(index: int, call: Callable[[], requests.Response]) -> None:
        try:
            barrier.wait(timeout=10)
            results[index] = call()
        except Exception as error:  # Se informa como resultado para no perder el otro hilo.
            results[index] = error

    threads = [threading.Thread(target=worker, args=(i, c), daemon=True) for i, c in enumerate(calls)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=60)
    errors = [r for r in results if not isinstance(r, requests.Response)]
    ensure(not errors, f"un pedido simultáneo no terminó: {errors}")
    return results


def codes(responses: list[requests.Response]) -> list[int]:
    return sorted(r.status_code for r in responses)


def status_post(session: Session, event_id: int, body: dict[str, Any]) -> Callable[[], requests.Response]:
    return lambda: session.request("POST", f"/api/events/{event_id}/status", json=body)


def clock_add(value: time, minutes: int) -> time:
    return (datetime.combine(datetime.today(), value) + timedelta(minutes=minutes)).time()


def entry_types(entries: list[dict[str, Any]]) -> list[str]:
    return [e.get("type", "") for e in entries]
