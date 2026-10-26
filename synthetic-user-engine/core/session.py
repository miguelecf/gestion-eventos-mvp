"""Sesión HTTP de una persona contra la aplicación.

Cada persona tiene su propia sesión, como un navegador distinto: inicia sesión por /auth/login,
guarda el par de tokens y, ante un 401, renueva una vez con /auth/refresh y repite el pedido,
igual que el interceptor del frontend. Todas las llamadas quedan en la traza del informe.
"""
from __future__ import annotations

import time
from typing import Any, Iterable

import requests

from core.report import CheckFailed, Report


class Session:
    def __init__(self, base_url: str, report: Report, *, username: str | None = None,
                 password: str | None = None, timeout: float = 15.0, label: str | None = None):
        self.base_url = base_url.rstrip("/")
        self.report = report
        self.username = username
        self.password = password
        self.timeout = timeout
        self.label = label or username or "anónimo"
        self.http = requests.Session()
        self.access_token: str | None = None
        self.refresh_token: str | None = None
        self.user: dict[str, Any] = {}
        self.must_change_password = False

    # -- autenticación -------------------------------------------------------------------------

    def login(self, password: str | None = None, *, expect: int | Iterable[int] = 200) -> dict[str, Any] | None:
        if password is not None:
            self.password = password
        res = self.request("POST", "/auth/login", auth=False, expect=expect,
                           json={"username": self.username, "password": self.password})
        if res.status_code != 200:
            return None
        body = res.json()
        self._store_tokens(body)
        return body

    def _store_tokens(self, body: dict[str, Any]) -> None:
        self.access_token = body.get("accessToken")
        self.refresh_token = body.get("refreshToken")
        self.user = body.get("user") or self.user
        self.must_change_password = bool(body.get("mustChangePassword"))

    def _refresh(self) -> bool:
        if not self.refresh_token:
            return False
        res = self._send("POST", "/auth/refresh", auth=False, json={"refreshToken": self.refresh_token})
        if res.status_code != 200:
            self.access_token = None
            self.refresh_token = None
            return False
        self._store_tokens(res.json())
        return True

    def logout(self) -> None:
        if self.refresh_token:
            self.request("POST", "/auth/logout", json={"refreshToken": self.refresh_token}, expect=(200, 204))
        self.access_token = None
        self.refresh_token = None

    @property
    def user_id(self) -> int | None:
        return self.user.get("id")

    # -- pedidos -------------------------------------------------------------------------------

    def request(self, method: str, path: str, *, expect: int | Iterable[int] | None = None,
                auth: bool = True, retry_on_401: bool = True, **kwargs: Any) -> requests.Response:
        res = self._send(method, path, auth=auth, **kwargs)
        if res.status_code == 401 and auth and retry_on_401 and self.refresh_token and self._refresh():
            res = self._send(method, path, auth=auth, **kwargs)
        if expect is not None:
            allowed = {expect} if isinstance(expect, int) else set(expect)
            if res.status_code not in allowed:
                raise CheckFailed(
                    f"{self.label}: {method} {path} respondió {res.status_code}, se esperaba "
                    f"{' o '.join(str(code) for code in sorted(allowed))}. Cuerpo: {snippet(res)}")
        return res

    def _send(self, method: str, path: str, *, auth: bool, **kwargs: Any) -> requests.Response:
        headers = {"Accept": "application/json", **kwargs.pop("headers", {})}
        if auth and self.access_token:
            headers["Authorization"] = f"Bearer {self.access_token}"
        started = time.monotonic()
        try:
            res = self.http.request(method, self.base_url + path, headers=headers, timeout=self.timeout, **kwargs)
        except requests.RequestException as error:
            self.report.trace(self.label, method, path, None, time.monotonic() - started)
            raise CheckFailed(f"{self.label}: {method} {path} no llegó al servidor: {error}") from error
        self.report.trace(self.label, method, path, res.status_code, time.monotonic() - started)
        return res

    def get(self, path: str, **kwargs: Any) -> requests.Response:
        return self.request("GET", path, **kwargs)

    def post(self, path: str, **kwargs: Any) -> requests.Response:
        return self.request("POST", path, **kwargs)

    def patch(self, path: str, **kwargs: Any) -> requests.Response:
        return self.request("PATCH", path, **kwargs)

    def json(self, method: str, path: str, *, expect: int | Iterable[int] = 200, **kwargs: Any) -> Any:
        """Pedido que debe responder con el código esperado y devuelve el cuerpo ya parseado."""
        res = self.request(method, path, expect=expect, **kwargs)
        return res.json() if res.content else None


def snippet(res: requests.Response, limit: int = 300) -> str:
    text = res.text.strip().replace("\n", " ")
    return text[:limit] + ("…" if len(text) > limit else "") if text else "(vacío)"
