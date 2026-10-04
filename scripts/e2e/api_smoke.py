#!/usr/bin/env python3
"""Disposable-stack API smoke test for the E1 plan.

Prerequisites (provided by the E3 runner):
- BASE_URL points to the isolated nginx stack (default http://127.0.0.1:18080).
- Seeded users admin.full/admin.ceremonial/admin.tecnica/viewer accept E2E_PASSWORD.
- The disposable database has exactly one active technical slot per block.
- The Mailpit override is running on MAILPIT_BASE_URL (default http://127.0.0.1:8025).

This script only uses HTTP APIs; it never connects to or mutates a database directly.
"""

from __future__ import annotations

import json
import os
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import date, timedelta
from typing import Any

BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:18080").rstrip("/")
MAILPIT_BASE_URL = os.environ.get(
    "MAILPIT_BASE_URL",
    f"http://127.0.0.1:{os.environ.get('MAILPIT_HOST_PORT', '8025')}",
).rstrip("/")
PASSWORD = os.environ.get("E2E_PASSWORD", "admin123")
TIMEOUT_SECONDS = float(os.environ.get("E2E_HTTP_TIMEOUT", "12"))
MAIL_TIMEOUT_SECONDS = float(os.environ.get("E2E_MAIL_TIMEOUT", "35"))
RUN_ID = uuid.uuid4().hex[:10]
REQUESTER_EMAIL = f"e2e-{RUN_ID}@example.test"

TOKENS: dict[str, str] = {}
REQUEST_ID: int | None = None
TRACKING_UUID: str | None = None
EVENT_ID: int | None = None
REJECTED_REQUEST_UUID: str | None = None
REJECTION_REASON = f"E2E rejection {RUN_ID}: capacity unavailable"
SPACE_IDS: list[int] = []
DEPARTMENT_ID: int | None = None
RESULTS: list[tuple[str, bool, str]] = []


class SmokeFailure(AssertionError):
    pass


def request(method: str, path: str, *, token: str | None = None, body: Any = None,
            base_url: str = BASE_URL, headers: dict[str, str] | None = None) -> tuple[int, Any, str]:
    url = base_url + path
    request_headers = {"Accept": "application/json"}
    if headers:
        request_headers.update(headers)
    payload = None
    if body is not None:
        payload = json.dumps(body).encode("utf-8")
        request_headers["Content-Type"] = "application/json"
    if token:
        request_headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=payload, headers=request_headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as response:
            raw = response.read().decode("utf-8", errors="replace")
            status = response.status
    except urllib.error.HTTPError as error:
        raw = error.read().decode("utf-8", errors="replace")
        status = error.code
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        raise SmokeFailure(f"{method} {url} transport failure: {error}") from error
    try:
        parsed = json.loads(raw) if raw else None
    except json.JSONDecodeError:
        parsed = None
    return status, parsed, raw


def expect_status(actual: int, expected: int | set[int], label: str) -> None:
    allowed = {expected} if isinstance(expected, int) else expected
    if actual not in allowed:
        raise SmokeFailure(f"{label}: expected HTTP {sorted(allowed)}, got {actual}")


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SmokeFailure(message)


def as_object(value: Any, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise SmokeFailure(f"{label}: expected JSON object, got {type(value).__name__}")
    return value


def as_array(value: Any, label: str) -> list[Any]:
    if not isinstance(value, list):
        raise SmokeFailure(f"{label}: expected JSON array, got {type(value).__name__}")
    return value


def auth(role: str) -> str:
    token = TOKENS.get(role)
    if not token:
        raise SmokeFailure(f"missing access token for {role}; its login case may have failed")
    return token


def future_date(days: int = 30) -> str:
    return (date.today() + timedelta(days=days)).isoformat()


def request_payload(name: str, *, audience: str = "TERCERA_EDAD") -> dict[str, Any]:
    if not SPACE_IDS:
        raise SmokeFailure("public space catalog is unavailable; cannot create the required request")
    payload: dict[str, Any] = {
        "date": future_date(30),
        "scheduleFrom": "10:00",
        "scheduleTo": "10:30",
        "space_id": SPACE_IDS[0],
        "name": name,
        "requirements": f"E2E run {RUN_ID}",
        "priority": "MEDIUM",
        "audienceType": audience,
        "contactName": "E2E Smoke",
        "contactEmail": REQUESTER_EMAIL,
        "contactPhone": "+541100000000",
    }
    if DEPARTMENT_ID is not None:
        payload["requesting_department_id"] = DEPARTMENT_ID
    return payload


def create_request(name: str) -> dict[str, Any]:
    status, result, raw = request("POST", "/public/event-requests", body=request_payload(name))
    expect_status(status, 201, f"create public request ({raw[:300]})")
    created = as_object(result, "created public request")
    require(isinstance(created.get("tracking_uuid"), str) and created["tracking_uuid"],
            f"creation response lacks tracking_uuid: {created}")
    return created


def create_event(name: str, space_id: int, *, requires_tech: bool = False) -> int:
    payload = {
        "date": future_date(45),
        "scheduleFrom": "10:00",
        "scheduleTo": "10:30",
        "spaceId": space_id,
        "departmentId": DEPARTMENT_ID,
        "name": name,
        "requestingArea": "E2E",
        "requirements": f"E2E run {RUN_ID}",
        "priority": "MEDIUM",
        "audienceType": "TERCERA_EDAD",
        "internal": False,
        "requiresTech": requires_tech,
        "techSupportMode": "ATTENDED" if requires_tech else None,
        "contactName": "E2E Smoke",
        "contactEmail": REQUESTER_EMAIL,
        "contactPhone": "+541100000000",
    }
    status, result, raw = request("POST", "/api/events", token=auth("admin.full"), body=payload)
    expect_status(status, 201, f"create event ({raw[:300]})")
    event_result = as_object(result, "event creation")
    event_id = event_result.get("eventId")
    require(isinstance(event_id, int), f"event creation has no eventId: {event_result}")
    return event_id


def case(name: str, action: Any) -> None:
    try:
        detail = action()
        RESULTS.append((name, True, str(detail or "")))
        print(f"PASS {name}" + (f" — {detail}" if detail else ""), flush=True)
    except Exception as error:  # Keep running to report independent and dependent failures.
        RESULTS.append((name, False, str(error)))
        print(f"FAIL {name} — {error}", flush=True)


def check_frontend_and_h2() -> str:
    status, _, raw = request("GET", "/")
    expect_status(status, 200, "GET /")
    require(bool(raw.strip()), "GET / returned an empty body")
    h2_status, _, h2_raw = request("GET", "/h2-console")
    expect_status(h2_status, {403, 404}, "GET /h2-console must not expose console")
    require("h2-console" not in h2_raw.lower() or h2_status in {403, 404},
            "H2 console response appears accessible")
    return "frontend 200; H2 console denied"


def check_public_catalog_and_availability() -> str:
    global SPACE_IDS
    status, result, raw = request("GET", "/public/catalogs/spaces")
    expect_status(status, 200, f"public spaces ({raw[:250]})")
    rows = as_array(result, "public spaces")
    SPACE_IDS = [item["id"] for item in rows if isinstance(item, dict) and isinstance(item.get("id"), int)]
    require(bool(SPACE_IDS), "public spaces response contains no usable id")
    check_status, _, check_raw = request("POST", "/public/availability/check", body={
        "date": future_date(60),
        "freeLocation": f"E2E public availability {RUN_ID}",
        "scheduleFrom": "10:00",
        "scheduleTo": "10:30",
    })
    expect_status(check_status, 200, f"unauthenticated public availability ({check_raw[:300]})")
    return f"{len(SPACE_IDS)} public spaces; unauthenticated availability 200"


def check_departments() -> str:
    global DEPARTMENT_ID
    status, result, raw = request("GET", "/api/catalogs/departments?size=100", token=auth("admin.full"))
    expect_status(status, 200, f"departments catalog ({raw[:250]})")
    page = as_object(result, "department page")
    content = as_array(page.get("content"), "department content")
    for department in content:
        if isinstance(department, dict) and isinstance(department.get("id"), int):
            DEPARTMENT_ID = department["id"]
            return f"using department id {DEPARTMENT_ID}"
    raise SmokeFailure("department catalog has no usable entries; event creation cannot be exercised")


def check_logins() -> str:
    usernames = ("admin.full", "admin.ceremonial", "admin.tecnica", "viewer")
    for username in usernames:
        status, result, raw = request("POST", "/auth/login", body={"username": username, "password": PASSWORD})
        expect_status(status, 200, f"login {username} ({raw[:250]})")
        response = as_object(result, f"login {username}")
        token = response.get("accessToken")
        require(isinstance(token, str) and token, f"login {username} returned no accessToken: {response}")
        TOKENS[username] = token
    return f"authenticated {len(usernames)} seeded accounts with configured E2E_PASSWORD"


def check_public_request_and_tracking() -> str:
    global REQUEST_ID, TRACKING_UUID
    created = create_request(f"E2E public request {RUN_ID}")
    TRACKING_UUID = created["tracking_uuid"]
    status, result, raw = request("GET", f"/public/track/{urllib.parse.quote(TRACKING_UUID)}")
    expect_status(status, 200, f"public tracking ({raw[:300]})")
    tracking = as_object(result, "public tracking")
    req = as_object(tracking.get("request"), "tracking request")
    schedule = as_object(tracking.get("schedule"), "tracking schedule")
    require(req.get("status") == "RECIBIDO", f"new request state is not RECIBIDO: {req}")
    schedule_from = schedule.get("from")
    require(isinstance(schedule_from, str) and len(schedule_from) == 5
            and schedule_from[2] == ":" and schedule_from[:2].isdigit()
            and schedule_from[3:].isdigit(),
            f"schedule.from is not HH:mm: {schedule_from!r}")
    # The admin queue response is checked in its own case, but retain id from the queue there.
    return f"tracking UUID {TRACKING_UUID}; request RECIBIDO; schedule {schedule_from}"


def check_public_write_list_forbidden() -> str:
    status, _, raw = request("GET", "/public/event-requests")
    expect_status(status, set(range(400, 500)), f"public request listing is not a public endpoint ({raw[:250]})")
    return f"public listing denied with HTTP {status}"


def check_admin_inbox_and_user_denial() -> str:
    global REQUEST_ID
    require(TRACKING_UUID is not None, "request creation did not produce a tracking UUID")
    status, result, raw = request("GET", "/admin/event-requests", token=auth("admin.full"))
    expect_status(status, 200, f"admin request inbox ({raw[:300]})")
    items = as_array(result, "admin request inbox")
    matches = [item for item in items if isinstance(item, dict) and item.get("trackingUuid") == TRACKING_UUID]
    require(bool(matches), f"created request {TRACKING_UUID} is absent from AF inbox")
    REQUEST_ID = matches[0].get("id")
    require(isinstance(REQUEST_ID, int), f"inbox request has no numeric id: {matches[0]}")
    denied, _, denied_raw = request("GET", "/admin/event-requests", token=auth("viewer"))
    expect_status(denied, 403, f"USUARIO inbox denial ({denied_raw[:250]})")
    return f"AF sees request id {REQUEST_ID}; USUARIO receives 403"


def check_request_review_conversion_and_history() -> str:
    global EVENT_ID
    if not isinstance(REQUEST_ID, int):
        raise SmokeFailure("request id unavailable from admin inbox")
    status, reviewed, raw = request("PATCH", f"/admin/event-requests/{REQUEST_ID}/status",
                                    token=auth("admin.full"), body={"newStatus": "EN_REVISION"})
    expect_status(status, 200, f"mark request EN_REVISION ({raw[:300]})")
    require(isinstance(reviewed, dict) and reviewed.get("status") == "EN_REVISION",
            f"request did not transition to EN_REVISION: {reviewed}")
    status, converted, raw = request("POST", f"/admin/event-requests/{REQUEST_ID}/convert-to-event",
                                     token=auth("admin.full"), body={"requiresTech": True, "techSupportMode": "ATTENDED"})
    expect_status(status, 200, f"convert request ({raw[:300]})")
    event = as_object(converted, "converted event")
    EVENT_ID = event.get("id")
    require(isinstance(EVENT_ID, int), f"conversion response has no event id: {event}")
    require(event.get("status") == "EN_REVISION", f"converted event state is not EN_REVISION: {event}")
    require(event.get("requiresTech") is True, f"converted event does not require tech: {event}")
    status, history, raw = request("GET", f"/admin/event-requests/{REQUEST_ID}/history", token=auth("admin.full"))
    expect_status(status, 200, f"request history ({raw[:300]})")
    transitions = as_array(history, "request history")
    require(any(isinstance(entry, dict) and isinstance(entry.get("actor"), dict)
                and entry["actor"].get("username") == "admin.full" for entry in transitions),
            f"history has no admin.full actor: {transitions}")
    return f"request converted to event {EVENT_ID}; history attributes actor admin.full"


def check_tracking_privacy() -> str:
    if not isinstance(EVENT_ID, int) or not TRACKING_UUID:
        raise SmokeFailure("converted event or tracking UUID unavailable")
    private_text = f"E2E PRIVATE COMMENT {RUN_ID} do not expose"
    status, result, raw = request("POST", f"/api/events/{EVENT_ID}/comments", token=auth("admin.full"),
                                 body={"body": private_text})
    expect_status(status, 201, f"create internal comment ({raw[:250]})")
    status, _, raw = request("GET", f"/public/track/{urllib.parse.quote(TRACKING_UUID)}")
    expect_status(status, 200, f"read public tracking privacy ({raw[:250]})")
    tracking = as_object(json.loads(raw), "public tracking privacy")
    require(private_text not in raw, "public tracking leaked internal comment text")
    require("event" not in tracking or not isinstance(tracking.get("event"), dict)
            or "id" not in tracking["event"], f"public tracking leaked event.id: {tracking.get('event')}")
    return "internal comment absent; event.id absent from public tracking"


def check_usuario_read_and_at_denial() -> str:
    for path in ("/api/events", "/api/catalogs/spaces"):
        status, _, raw = request("GET", path, token=auth("viewer"))
        expect_status(status, 200, f"USUARIO read {path} ({raw[:250]})")
    # Use a syntactically valid body; a 403 must come from authorization rather than validation.
    denied, _, raw = request("POST", "/api/priority/decisions", token=auth("admin.tecnica"), body={
        "conflictId": "E2E-NONEXISTENT",
        "decision": "KEEP_ORIGINAL",
        "reason": f"E2E {RUN_ID}",
    })
    expect_status(denied, 403, f"AT cannot decide priority conflicts ({raw[:250]})")
    unauthenticated, _, raw = request("GET", "/admin/event-requests")
    expect_status(unauthenticated, set(range(400, 500)), f"anonymous admin inbox denial ({raw[:250]})")
    event_id = EVENT_ID if isinstance(EVENT_ID, int) else 999999999
    edit_status, _, edit_raw = request("PATCH", f"/api/events/{event_id}", token=auth("viewer"), body={"name": "forbidden"})
    expect_status(edit_status, 403, f"USUARIO event edit denial ({edit_raw[:250]})")
    return "USUARIO reads allowed; edit 403; AT decision 403; anonymous inbox denied"


def check_approval_and_public_event() -> str:
    if not isinstance(EVENT_ID, int):
        raise SmokeFailure("converted event id unavailable")
    ac_status, pending, raw = request("POST", f"/api/events/{EVENT_ID}/status", token=auth("admin.ceremonial"),
                                      body={"to": "APROBADO", "ceremonialOk": True})
    expect_status(ac_status, 202, f"AC approval pending technical conformity ({raw[:300]})")
    require(isinstance(pending, dict) and pending.get("approvalPending") is True,
            f"AC approval did not remain pending: {pending}")
    at_status, approved, raw = request("POST", f"/api/events/{EVENT_ID}/status", token=auth("admin.tecnica"),
                                        body={"to": "APROBADO", "technicalOk": True})
    expect_status(at_status, 200, f"AT approval ({raw[:300]})")
    require(isinstance(approved, dict) and approved.get("status") == "APROBADO",
            f"event did not reach APROBADO: {approved}")
    public_status, public_result, raw = request("GET", "/public/events")
    expect_status(public_status, 200, f"public events ({raw[:300]})")
    events = as_array(public_result, "public events")
    require(any(isinstance(item, dict) and item.get("id") == EVENT_ID for item in events),
            f"approved event {EVENT_ID} absent from public events")
    return "AC received 202; AT completed approval; event appears publicly"


def check_event_edit_and_rejection() -> str:
    if not isinstance(EVENT_ID, int):
        raise SmokeFailure("event id unavailable")
    changed_date = future_date(31)
    status, result, raw = request("PATCH", f"/api/events/{EVENT_ID}", token=auth("admin.full"), body={"date": changed_date})
    expect_status(status, 200, f"edit approved event date ({raw[:300]})")
    require(isinstance(result, dict) and result.get("status") == "EN_REVISION",
            f"approved event date edit did not return to EN_REVISION: {result}")
    no_reason, _, raw = request("POST", f"/api/events/{EVENT_ID}/status", token=auth("admin.full"),
                                body={"to": "RECHAZADO"})
    expect_status(no_reason, 400, f"event rejection requires reason ({raw[:250]})")
    with_reason, result, raw = request("POST", f"/api/events/{EVENT_ID}/status", token=auth("admin.full"),
                                       body={"to": "RECHAZADO", "reason": f"E2E event rejection {RUN_ID}"})
    expect_status(with_reason, 200, f"event rejection with reason ({raw[:250]})")
    require(isinstance(result, dict) and result.get("status") == "RECHAZADO",
            f"event did not become RECHAZADO: {result}")
    edit_rejected, _, raw = request("PATCH", f"/api/events/{EVENT_ID}", token=auth("admin.full"), body={"name": "must fail"})
    expect_status(edit_rejected, 400, f"rejected event must not be editable ({raw[:250]})")
    return "approved date edit returned EN_REVISION; rejection reason enforced; RECHAZADO edit 400"


def check_request_rejection() -> str:
    global REJECTED_REQUEST_UUID
    created = create_request(f"E2E rejected request {RUN_ID}")
    REJECTED_REQUEST_UUID = created["tracking_uuid"]
    # Resolve the just-created row through the AF inbox to avoid assuming IDs are contiguous.
    status, inbox, raw = request("GET", "/admin/event-requests", token=auth("admin.full"))
    expect_status(status, 200, f"read inbox for rejection case ({raw[:250]})")
    rows = as_array(inbox, "admin inbox for rejection")
    match = next((row for row in rows if isinstance(row, dict) and row.get("trackingUuid") == REJECTED_REQUEST_UUID), None)
    require(isinstance(match, dict) and isinstance(match.get("id"), int),
            f"new rejection request absent from inbox: {REJECTED_REQUEST_UUID}")
    request_id = match["id"]
    status, _, raw = request("PATCH", f"/admin/event-requests/{request_id}/status", token=auth("admin.ceremonial"),
                             body={"newStatus": "RECHAZADO"})
    expect_status(status, 400, f"request rejection requires reason ({raw[:250]})")
    status, result, raw = request("PATCH", f"/admin/event-requests/{request_id}/status", token=auth("admin.ceremonial"),
                                  body={"newStatus": "RECHAZADO", "reason": REJECTION_REASON})
    expect_status(status, 200, f"request rejection with reason ({raw[:250]})")
    require(isinstance(result, dict) and result.get("status") == "RECHAZADO",
            f"request did not become RECHAZADO: {result}")
    status, tracking, raw = request("GET", f"/public/track/{urllib.parse.quote(REJECTED_REQUEST_UUID)}")
    expect_status(status, 200, f"read rejected request tracking ({raw[:250]})")
    response = as_object(tracking, "rejected request tracking")
    require(response.get("rejectionReason") == REJECTION_REASON,
            f"tracking rejectionReason mismatch: {response.get('rejectionReason')!r}")
    return "missing reason 400; reason accepted; tracking exposes rejectionReason to requester"


def check_soft_delete_audit() -> str:
    if not isinstance(EVENT_ID, int):
        raise SmokeFailure("event id unavailable")
    status, _, raw = request("PATCH", f"/api/events/{EVENT_ID}/soft-delete", token=auth("admin.full"))
    expect_status(status, 204, f"AF soft-delete event ({raw[:250]})")
    status, audit, raw = request("GET", f"/api/audit/{EVENT_ID}", token=auth("admin.full"))
    expect_status(status, 200, f"read event audit ({raw[:250]})")
    page = as_object(audit, "event audit")
    entries = as_array(page.get("entries"), "audit entries")
    deletions = [entry for entry in entries if isinstance(entry, dict) and entry.get("type") == "EVENT_DELETED"]
    require(bool(deletions), f"audit lacks EVENT_DELETED: {entries}")
    require(any(isinstance(entry.get("actor"), dict) and entry["actor"].get("username") == "admin.full"
                for entry in deletions), f"EVENT_DELETED audit has no admin.full actor: {deletions}")
    return "soft-delete 204; EVENT_DELETED audit attributes admin.full"


def check_technical_capacity_concurrency() -> str:
    require(len(SPACE_IDS) >= 2, f"need at least two public spaces for distinct-space capacity test; found {len(SPACE_IDS)}")
    event_ids = [create_event(f"E2E capacity {RUN_ID} #{index}", SPACE_IDS[index], requires_tech=True)
                 for index in range(2)]
    barrier = threading.Barrier(2)
    outcomes: list[tuple[int, str]] = []
    outcome_lock = threading.Lock()

    def reserve(event_id: int) -> None:
        try:
            barrier.wait(timeout=5)
            status, _, raw = request("POST", f"/api/events/{event_id}/status", token=auth("admin.full"),
                                     body={"to": "RESERVADO"})
            with outcome_lock:
                outcomes.append((status, raw))
        except Exception as error:
            with outcome_lock:
                outcomes.append((-1, str(error)))

    threads = [threading.Thread(target=reserve, args=(event_id,), daemon=True) for event_id in event_ids]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=TIMEOUT_SECONDS + 5)
    require(all(not thread.is_alive() for thread in threads), "reservation worker thread timed out")
    codes = sorted(status for status, _ in outcomes)
    require(codes == [200, 409], f"expected exactly one reservation 200 and one capacity conflict 409; got {outcomes}")
    return f"events {event_ids} raced across distinct spaces; outcomes {codes} with one configured technical slot"


def flatten_strings(value: Any) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, dict):
        result: list[str] = []
        for child in value.values():
            result.extend(flatten_strings(child))
        return result
    if isinstance(value, list):
        result = []
        for child in value:
            result.extend(flatten_strings(child))
        return result
    return []


def check_mailpit_evidence() -> str:
    require(TRACKING_UUID is not None and REJECTED_REQUEST_UUID is not None,
            "request UUIDs missing; cannot verify confirmation/review/rejection/conversion mail")
    deadline = time.monotonic() + MAIL_TIMEOUT_SECONDS
    expected = {
        "confirmation": (TRACKING_UUID,),
        "review": (REQUESTER_EMAIL, "siendo revisada"),
        "rejection": (REQUESTER_EMAIL, REJECTION_REASON),
        "conversion": (REQUESTER_EMAIL, "se convirtió en un evento"),
    }
    found: set[str] = set()
    last_error = "no messages returned"
    while time.monotonic() < deadline:
        try:
            status, result, raw = request("GET", "/api/v1/messages?start=0&limit=100", base_url=MAILPIT_BASE_URL)
            expect_status(status, 200, f"Mailpit message list ({raw[:250]})")
            payload = as_object(result, "Mailpit messages")
            messages = payload.get("messages")
            if not isinstance(messages, list):
                raise SmokeFailure(f"Mailpit response lacks messages array: {payload}")
            for message in messages:
                if not isinstance(message, dict):
                    continue
                message_id = message.get("ID") or message.get("Id") or message.get("id")
                searchable = " ".join(flatten_strings(message))
                # Retrieve full message bodies; list items may expose only snippets.
                if message_id:
                    detail_status, detail, detail_raw = request(
                        "GET", f"/api/v1/message/{urllib.parse.quote(str(message_id))}", base_url=MAILPIT_BASE_URL)
                    expect_status(detail_status, 200, f"Mailpit message {message_id} ({detail_raw[:200]})")
                    searchable += " " + " ".join(flatten_strings(detail))
                for label, needles in expected.items():
                    if all(needle.lower() in searchable.lower() for needle in needles):
                        found.add(label)
            if found == set(expected):
                return "Mailpit contains confirmation UUID, review, rejection reason, and conversion notice"
            last_error = f"found {sorted(found)} of {sorted(expected)}"
        except Exception as error:
            last_error = str(error)
        time.sleep(1)
    raise SmokeFailure(f"Mailpit evidence incomplete after {MAIL_TIMEOUT_SECONDS:.0f}s: {last_error}")


def main() -> int:
    print(f"API smoke target: {BASE_URL}", flush=True)
    print(f"Mailpit target: {MAILPIT_BASE_URL}; run id: {RUN_ID}", flush=True)
    # Prerequisite discovery is explicit and independently reported; downstream cases fail rather than skip.
    case("frontend and H2 console boundary", check_frontend_and_h2)
    case("public spaces and unauthenticated availability (A2)", check_public_catalog_and_availability)
    case("seeded department catalog", check_departments)
    case("login for all four seeded users", check_logins)
    case("public request creation and tracking", check_public_request_and_tracking)
    case("public request-list denial", check_public_write_list_forbidden)
    case("AF inbox visibility and USUARIO denial", check_admin_inbox_and_user_denial)
    case("request review, conversion, and actor history", check_request_review_conversion_and_history)
    case("public tracking privacy", check_tracking_privacy)
    case("role permissions", check_usuario_read_and_at_denial)
    case("approval flow and public event listing", check_approval_and_public_event)
    case("approved edit and event rejection rules", check_event_edit_and_rejection)
    case("request rejection and public reason", check_request_rejection)
    case("soft-delete audit attribution", check_soft_delete_audit)
    case("technical capacity concurrency", check_technical_capacity_concurrency)
    case("Mailpit lifecycle evidence", check_mailpit_evidence)
    failed = sum(not passed for _, passed, _ in RESULTS)
    print(f"\nAPI smoke summary: {len(RESULTS) - failed} passed, {failed} failed", flush=True)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
