#!/usr/bin/env bash
# Run migrations, seed and SQL tests against a throwaway Postgres database.
#
# Uses $DATABASE_URL if set (CI provides a postgres service). Otherwise starts
# a temporary local cluster with the installed Postgres binaries.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP=""
RUN=()

cleanup() {
  if [[ -n "$TMP" ]]; then
    "${RUN[@]}" "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true
    rm -rf "$TMP"
  fi
}
trap cleanup EXIT

if [[ -z "${DATABASE_URL:-}" ]]; then
  PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
  [[ -x "$PGBIN/initdb" ]] || { echo "Postgres binaries not found; set PGBIN or DATABASE_URL" >&2; exit 1; }
  TMP="$(mktemp -d)"
  PORT="${PGPORT_TEST:-54329}"
  # Postgres refuses to run as root.
  if [[ "$(id -u)" == "0" ]]; then
    chown postgres "$TMP"
    RUN=(runuser -u postgres --)
  fi
  "${RUN[@]}" "$PGBIN/initdb" -D "$TMP/data" -U postgres -A trust >/dev/null
  "${RUN[@]}" "$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/log" -w start >/dev/null
  DATABASE_URL="postgresql://postgres@/postgres?host=$TMP&port=$PORT"
fi

PSQL=(psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1)

echo "== bootstrap"
"${PSQL[@]}" -f "$ROOT/supabase/tests/_bootstrap.sql"

echo "== migrations"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "   $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done

echo "== seed"
"${PSQL[@]}" -f "$ROOT/supabase/seed.sql"

echo "== helpers"
"${PSQL[@]}" -f "$ROOT/supabase/tests/_helpers.sql"

echo "== fixtures"
"${PSQL[@]}" -f "$ROOT/supabase/tests/_fixtures.sql"

echo "== tests"
fail=0
for f in "$ROOT"/supabase/tests/[0-9]*.sql; do
  name="$(basename "$f")"
  if out="$("${PSQL[@]}" -t -f "$f" 2>&1)"; then
    count="$(grep -c 'ok - ' <<<"$out" || true)"
    echo "   PASS $name ($count assertions)"
  else
    echo "   FAIL $name"
    grep -E 'ok - |ERROR|FAIL|DETAIL|HINT' <<<"$out" | tail -n 8 | sed 's/^/      /'
    fail=1
  fi
done

exit $fail
