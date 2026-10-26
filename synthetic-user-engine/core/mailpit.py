"""Lectura de la casilla de Mailpit, para los pasos que dependen de un correo (alta de cuenta).

Es opcional: el stack local no publica Mailpit salvo que se levante con
docker-compose.mail-access.yml. Sin acceso, esos pasos quedan omitidos y no fallan.
"""
from __future__ import annotations

import re
import time

import requests

PASSWORD_PATTERN = re.compile(r"contrasenia es:\s*(\S+)")


class Mailpit:
    def __init__(self, base_url: str | None, timeout: float = 20.0):
        self.base_url = base_url.rstrip("/") if base_url else None
        self.timeout = timeout

    def available(self) -> bool:
        if not self.base_url:
            return False
        try:
            return requests.get(f"{self.base_url}/api/v1/messages?limit=1", timeout=3).status_code == 200
        except requests.RequestException:
            return False

    def temporary_password(self, email: str) -> str | None:
        """Espera el correo de alta o restablecimiento más reciente para la dirección y extrae la clave."""
        deadline = time.monotonic() + self.timeout
        while time.monotonic() < deadline:
            res = requests.get(f"{self.base_url}/api/v1/search",
                               params={"query": f'to:"{email}"', "limit": 5}, timeout=5)
            for message in (res.json().get("messages") or []) if res.ok else []:
                detail = requests.get(f"{self.base_url}/api/v1/message/{message['ID']}", timeout=5)
                match = PASSWORD_PATTERN.search(detail.json().get("Text", "")) if detail.ok else None
                if match:
                    return match.group(1)
            time.sleep(1)
        return None
