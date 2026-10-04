#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT="gestion-eventos-mvp-e2e"
LOCK_DIR="/tmp/gestion-eventos-mvp-e2e.lock"
BASE_URL="http://127.0.0.1:18080"
MAILPIT_BASE_URL="http://127.0.0.1:18025"
COMPOSE_FILES=("docker-compose.yml" "docker-compose.mail-access.yml")
KEEP_STACK=0
CLEANUP_ENABLED=0
LOCK_ACQUIRED=0
DISPOSABLE_DB_PASSWORD='e2e-disposable-root-only'
VALIDATED_DOCKER_CONTEXT=

usage() {
  cat <<'USAGE'
Usage: scripts/e2e/run.sh [--keep]

Runs API and Playwright E2E checks against the isolated Compose project
gestion-eventos-mvp-e2e on 127.0.0.1:18080 (Mailpit: 127.0.0.1:18025).
By default, the exact isolated project and its volumes are removed on exit.
Use --keep to retain the isolated stack for debugging.
USAGE
}

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

for arg in "$@"; do
  case "$arg" in
    --keep)
      [[ "$KEEP_STACK" == 0 ]] || fail "--keep may be specified only once"
      KEEP_STACK=1
      ;;
    -h|--help)
      [[ "$#" == 1 ]] || fail "--help cannot be combined with other arguments"
      usage
      exit 0
      ;;
    *)
      fail "unknown argument: $arg"
      ;;
  esac
done

docker_cli() {
  docker --context "$VALIDATED_DOCKER_CONTEXT" "$@"
}

compose() {
  docker_cli compose --project-name "$PROJECT" \
    --file "${COMPOSE_FILES[0]}" \
    --file "${COMPOSE_FILES[1]}" "$@"
}

cleanup() {
  local exit_code=$?
  local cleanup_code=0
  trap - EXIT

  if [[ "$CLEANUP_ENABLED" == 1 ]]; then
    if [[ "$KEEP_STACK" == 1 ]]; then
      printf '\nKeeping isolated project %s for debugging. Remove it only with the same two Compose files and project name.\n' "$PROJECT"
    else
      printf '\nCleaning up isolated project %s and its disposable volumes...\n' "$PROJECT"
      if compose down --volumes --remove-orphans; then
        printf 'Cleanup complete for %s.\n' "$PROJECT"
      else
        cleanup_code=$?
        printf 'ERROR: cleanup failed for isolated project %s (exit %s).\n' "$PROJECT" "$cleanup_code" >&2
        if [[ "$exit_code" == 0 ]]; then
          exit_code=$cleanup_code
        fi
      fi
    fi
  fi

  if [[ "$LOCK_ACQUIRED" == 1 ]]; then
    if rmdir "$LOCK_DIR"; then
      LOCK_ACQUIRED=0
    else
      printf 'WARNING: could not release runner lock %s; verify no E2E runner remains before removing it.\n' "$LOCK_DIR" >&2
      if [[ "$exit_code" == 0 ]]; then
        exit_code=1
      fi
    fi
  fi

  exit "$exit_code"
}
trap cleanup EXIT

[[ -f "${COMPOSE_FILES[0]}" && -f "${COMPOSE_FILES[1]}" ]] || fail "run this script from the repository root"
[[ -f scripts/e2e/api_smoke.py && -f frontend/playwright.config.ts ]] || fail "E1 API smoke or E2 Playwright configuration is missing"
command -v docker >/dev/null 2>&1 || fail "Docker CLI is required"
command -v curl >/dev/null 2>&1 || fail "curl is required"
command -v python3 >/dev/null 2>&1 || fail "Python 3 is required"

# Reject implicit daemon overrides, then pin every later Docker operation to
# the selected context only after proving its endpoint is a local Unix socket.
if [[ ${DOCKER_HOST+x} || ${DOCKER_CONTEXT+x} ]]; then
  fail "DOCKER_HOST and DOCKER_CONTEXT overrides are not allowed; unset both and select a local Unix-socket Docker context"
fi
VALIDATED_DOCKER_CONTEXT=$(docker context show) || fail "could not determine the selected Docker context"
[[ -n "$VALIDATED_DOCKER_CONTEXT" ]] || fail "Docker selected an empty context name"
docker_endpoint=$(docker context inspect "$VALIDATED_DOCKER_CONTEXT" --format '{{.Endpoints.docker.Host}}') \
  || fail "could not inspect the selected Docker context endpoint"
if [[ "$docker_endpoint" != unix:///* ]]; then
  fail "selected Docker context '$VALIDATED_DOCKER_CONTEXT' is not a local Unix-socket endpoint; refusing remote or unknown daemon"
fi

# Pin every Compose input that could redirect data, mail, or browser API traffic.
# These values deliberately override ambient exports and repository .env values.
export FRONTEND_HOST=127.0.0.1
export FRONTEND_PORT=18080
export MAILPIT_HOST_PORT=18025
export APP_PUBLIC_BASE_URL="$BASE_URL"
export APP_CORS_ALLOWED_ORIGINS="$BASE_URL"
export MYSQL_DATABASE=eventosbd
export MYSQL_ROOT_PASSWORD="$DISPOSABLE_DB_PASSWORD"
export MYSQL_HOST=127.0.0.1
export MYSQL_HOST_PORT=3307
export SPRING_PROFILES_ACTIVE=docker
export SPRING_DATASOURCE_URL='jdbc:mysql://mysql:3306/eventosbd?createDatabaseIfNotExist=true&useUnicode=true&characterEncoding=utf8&useSSL=false&serverTimezone=UTC&useTimezone=false'
export SPRING_DATASOURCE_USERNAME=root
export SPRING_DATASOURCE_PASSWORD="$DISPOSABLE_DB_PASSWORD"
export DB_WAIT_TIMEOUT_SECONDS=120
export MAIL_HOST=mailhog
export MAIL_PORT=1025
export MAIL_FROM=noreply@gestion-eventos.local
export MAIL_MOCK_MODE=false
export MAIL_FAIL_ON_ERROR=true
export MAIL_USERNAME=
export MAIL_PASSWORD=
export MAIL_SMTP_AUTH=false
export MAIL_SMTP_STARTTLS_ENABLE=false
export BACKEND_JAVA_OPTS=
export VITE_API_BASE_URL=
export JWT_SECRET='e2e-only-signing-secret-not-for-reuse-0123456789abcdef0123456789abcdef'
export JWT_ACCESS_TOKEN_EXPIRATION=900000
export JWT_REFRESH_TOKEN_EXPIRATION=604800000

# Serialize this fixed project from preflight through cleanup. A stale lock is
# never auto-removed because doing so could race a live runner.
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  fail "another E2E runner holds $LOCK_DIR (if stale, verify no runner is active before removing it)"
fi
LOCK_ACQUIRED=1

assert_rendered_compose_config() {
  compose config --format json | python3 -c '
import json
import sys
from urllib.parse import urlsplit

config = json.load(sys.stdin)
services = config.get("services", {})
backend = services.get("backend", {})
database = services.get("mysql", {})
frontend = services.get("frontend", {})
mailpit = services.get("mailhog", {})
backend_env = backend.get("environment", {})
database_env = database.get("environment", {})
build_args = frontend.get("build", {}).get("args", {})

def require(condition, message):
    if not condition:
        raise SystemExit("ERROR: rendered Compose config failed isolation check: " + message)

datasource_url = backend_env.get("SPRING_DATASOURCE_URL", "")
datasource = urlsplit(datasource_url.removeprefix("jdbc:"))
require(datasource.scheme == "mysql", "database host is not internal mysql")
require(datasource.netloc == "mysql:3306" and datasource.path == "/eventosbd", "database target is not mysql:3306/eventosbd")
require(backend_env.get("SPRING_DATASOURCE_USERNAME") == "root", "backend database user is not the disposable root user")
require(backend_env.get("SPRING_DATASOURCE_PASSWORD") == "e2e-disposable-root-only", "backend datasource credential is not pinned")
require(database_env.get("MYSQL_DATABASE") == "eventosbd", "MySQL database name is not pinned")
require(database_env.get("MYSQL_ROOT_PASSWORD") == "e2e-disposable-root-only", "MySQL root credential is not pinned")
require(backend_env.get("SPRING_PROFILES_ACTIVE") == "docker", "Spring profile is not docker")
require(backend_env.get("MAIL_HOST") == "mailhog" and backend_env.get("MAIL_PORT") == "1025", "mail is not routed to internal Mailpit")
require(backend_env.get("MAIL_MOCK_MODE") == "false", "Mailpit delivery is unexpectedly mocked")
require(backend_env.get("MAIL_FAIL_ON_ERROR") == "true", "mail delivery failures are not surfaced")
require(backend_env.get("MAIL_SMTP_AUTH") == "false" and backend_env.get("MAIL_SMTP_STARTTLS_ENABLE") == "false", "external SMTP auth/TLS settings are enabled")
require(backend_env.get("MAIL_USERNAME", "") == "" and backend_env.get("MAIL_PASSWORD", "") == "", "SMTP credentials are not empty")
require(build_args.get("VITE_API_BASE_URL", "") == "", "frontend API base URL could target an external API")
require(backend_env.get("APP_PUBLIC_BASE_URL") == "http://127.0.0.1:18080", "public URL is not the isolated runner URL")
require(backend_env.get("APP_CORS_ALLOWED_ORIGINS") == "http://127.0.0.1:18080", "CORS is not pinned to the isolated runner URL")
require(backend_env.get("JWT_SECRET") == "e2e-only-signing-secret-not-for-reuse-0123456789abcdef0123456789abcdef", "JWT secret is not pinned for E2E")
require(backend_env.get("JWT_ACCESS_TOKEN_EXPIRATION") == "900000" and backend_env.get("JWT_REFRESH_TOKEN_EXPIRATION") == "604800000", "JWT expirations are not pinned for E2E")
require(not backend.get("ports"), "backend must not publish a host port")
require(not database.get("ports"), "MySQL must not publish a host port")
frontend_ports = frontend.get("ports", [])
mailpit_ports = mailpit.get("ports", [])
require(len(frontend_ports) == 1, "frontend must publish exactly one port")
require(frontend_ports[0].get("host_ip") == "127.0.0.1", "frontend must bind only to loopback")
require(str(frontend_ports[0].get("target")) == "80" and frontend_ports[0].get("published") == "18080",
        "frontend must publish container port 80 on host port 18080")
require(len(mailpit_ports) == 1, "Mailpit must publish exactly one port")
require(mailpit_ports[0].get("host_ip") == "127.0.0.1", "Mailpit must bind only to loopback")
require(str(mailpit_ports[0].get("target")) == "8025" and mailpit_ports[0].get("published") == "18025",
        "Mailpit must publish container port 8025 on host port 18025")
print("PASS: rendered Compose configuration is pinned to the disposable E2E database, internal Mailpit, and local frontend.")
'
}

assert_rendered_compose_config || fail "Compose config assertion failed; no stack was started or cleaned up"

# Never adopt or destroy an existing project with this name. Every Docker
# inventory query is constrained to the exact Compose project label.
existing_containers=$(docker_cli ps --all --quiet --filter "label=com.docker.compose.project=$PROJECT") || fail "could not inspect Docker containers"
existing_volumes=$(docker_cli volume ls --quiet --filter "label=com.docker.compose.project=$PROJECT") || fail "could not inspect Docker volumes"
existing_networks=$(docker_cli network ls --quiet --filter "label=com.docker.compose.project=$PROJECT") || fail "could not inspect Docker networks"
if [[ -n "$existing_containers$existing_volumes$existing_networks" ]]; then
  fail "Docker resources already exist for $PROJECT; inspect this exact disposable project before rerunning (nothing was changed)"
fi

printf 'E2E project: %s\n' "$PROJECT"
printf 'Docker context: %s (validated local Unix socket).\n' "$VALIDATED_DOCKER_CONTEXT"
printf 'Application: %s | Mailpit: %s\n' "$BASE_URL" "$MAILPIT_BASE_URL"
if [[ "$KEEP_STACK" == 1 ]]; then
  printf 'Cleanup: --keep requested; retain only this isolated project for debugging.\n'
else
  printf 'Cleanup: always run Compose down --volumes for %s, including partial startup/failure.\n' "$PROJECT"
fi
printf 'Concurrency: runner lock %s acquired for preflight, run, and cleanup.\n' "$LOCK_DIR"

# Enable the trap immediately before startup so partial `up` failures are also
# cleaned, while failures in preflight can never tear down existing resources.
CLEANUP_ENABLED=1
compose up --detach --build

printf 'Waiting up to 180 seconds for backend and frontend readiness...\n'
deadline=$((SECONDS + 180))
ready=0
while (( SECONDS < deadline )); do
  if compose exec --no-TTY backend curl --fail --silent --show-error --max-time 3 \
      http://127.0.0.1:9090/actuator/health >/dev/null 2>&1 \
      && curl --fail --silent --show-error --max-time 3 "$BASE_URL/" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 3
done
[[ "$ready" == 1 ]] || fail "backend/frontend did not become ready within 180 seconds"
printf 'PASS: backend actuator health and frontend root are ready.\n'

login_ok() {
  local password=$1
  E2E_PROBE_PASSWORD="$password" E2E_PROBE_URL="$BASE_URL/auth/login" python3 - <<'PY'
import json
import os
import urllib.error
import urllib.request

payload = json.dumps({"username": "admin.full", "password": os.environ["E2E_PROBE_PASSWORD"]}).encode()
request = urllib.request.Request(
    os.environ["E2E_PROBE_URL"],
    data=payload,
    headers={"Content-Type": "application/json"},
    method="POST",
)
try:
    with urllib.request.urlopen(request, timeout=10) as response:
        body = json.loads(response.read().decode())
        raise SystemExit(0 if response.status == 200 and body.get("accessToken") else 1)
except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, OSError, ValueError):
    raise SystemExit(1)
PY
}

export E2E_PASSWORD=admin123
if login_ok "$E2E_PASSWORD"; then
  printf 'PASS: admin.full login verified with the seeded admin123 password.\n'
else
  printf 'Seeded admin123 login failed; setting a known password for the disposable seeded users only.\n'
  command -v htpasswd >/dev/null 2>&1 || fail "htpasswd is required only because the disposable seed-password fallback is needed"
  E2E_PASSWORD='E2eDisposable2026!'
  bcrypt_hash=$(htpasswd -bnBC 10 '' "$E2E_PASSWORD" | cut -d: -f2 | sed 's/^\$2y\$/\$2a\$/')
  hash_pattern='^\$2a\$10\$[./A-Za-z0-9]{53}$'
  [[ "$bcrypt_hash" =~ $hash_pattern ]] || fail "htpasswd did not produce the expected BCrypt hash"

  update_result=$(
    printf "UPDATE users SET password = '%s', must_change_password = b'0', failed_login_attempts = 0 WHERE username IN ('admin.full', 'admin.ceremonial', 'admin.tecnica', 'viewer');\nSELECT COUNT(*) FROM users WHERE username IN ('admin.full', 'admin.ceremonial', 'admin.tecnica', 'viewer') AND password = '%s';\n" \
      "$bcrypt_hash" "$bcrypt_hash" \
      | compose exec --no-TTY mysql sh -ec 'export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; mysql --user=root "$MYSQL_DATABASE" --batch --skip-column-names'
  ) || fail "could not update seeded credentials in the exact disposable database"
  [[ "$update_result" == 4 ]] || fail "expected to update exactly four seeded users; database confirmed $update_result"
  export E2E_PASSWORD
  login_ok "$E2E_PASSWORD" || fail "admin.full login failed after disposable credential reset"
  printf 'PASS: disposable seeded users now use the generated E2E_PASSWORD.\n'
fi

# The API smoke needs an externally reachable Mailpit URL and fixes technical
# capacity only in this isolated MySQL service before its concurrency test.
capacity_count=$(
  printf "UPDATE tech_capacity_config SET default_slots_per_block = 1 WHERE active = b'1';\nSELECT COUNT(*) FROM tech_capacity_config WHERE active = b'1' AND default_slots_per_block = 1;\n" \
    | compose exec --no-TTY mysql sh -ec 'export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; mysql --user=root "$MYSQL_DATABASE" --batch --skip-column-names'
) || fail "could not configure technical capacity in the exact disposable database"
[[ "$capacity_count" =~ ^[1-9][0-9]*$ ]] || fail "no active technical capacity row was configured to one slot"
printf 'PASS: technical capacity set to one slot on %s active row(s) in the disposable database.\n' "$capacity_count"

printf '\nRunning E1 API smoke against %s (Mailpit %s)...\n' "$BASE_URL" "$MAILPIT_BASE_URL"
BASE_URL="$BASE_URL" MAILPIT_BASE_URL="$MAILPIT_BASE_URL" E2E_PASSWORD="$E2E_PASSWORD" \
  python3 scripts/e2e/api_smoke.py

printf '\nRunning E2 Playwright suite against %s...\n' "$BASE_URL"
(cd frontend && E2E_BASE_URL="$BASE_URL" E2E_PASSWORD="$E2E_PASSWORD" npx playwright test)

printf '\nPASS: E1 API smoke and E2 Playwright suite completed successfully.\n'
