#!/bin/sh
set -eu

DB_HOST="${DB_HOST:-mysql}"
DB_PORT="${DB_PORT:-3306}"
WAIT_TIMEOUT_SECONDS="${DB_WAIT_TIMEOUT_SECONDS:-120}"

end_time=$(( $(date +%s) + WAIT_TIMEOUT_SECONDS ))

while ! getent hosts "$DB_HOST" >/dev/null 2>&1; do
  if [ "$(date +%s)" -ge "$end_time" ]; then
    echo "Timed out waiting for DNS name '$DB_HOST'" >&2
    exit 1
  fi

  echo "Waiting for Docker DNS name '$DB_HOST'..."
  sleep 2
done

while ! nc -z "$DB_HOST" "$DB_PORT" >/dev/null 2>&1; do
  if [ "$(date +%s)" -ge "$end_time" ]; then
    echo "Timed out waiting for $DB_HOST:$DB_PORT" >&2
    exit 1
  fi

  echo "Waiting for database at $DB_HOST:$DB_PORT..."
  sleep 2
done

exec java $JAVA_OPTS -jar /app/app.jar
