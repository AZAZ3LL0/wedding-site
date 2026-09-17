#!/usr/bin/env bash
# Proves the latest dump restores: loads it into a scratch database next to the live one,
# compares the tables with the live schema and drops the scratch copy. Run weekly by cron.
set -euo pipefail

compose_file="${COMPOSE_FILE:-/srv/wedding/shared/postgres.compose.yml}"
dir="${BACKUP_DIR:-/srv/wedding/backups}"
max_age_hours="${MAX_AGE_HOURS:-36}"
scratch=wedding_restore_check

fail() {
	echo "$(date -u +%FT%TZ) restore check FAILED: $1" >&2
	exit 1
}

psql() {
	docker compose -f "$compose_file" exec -T postgres \
		sh -c 'PGOPTIONS="-c client_min_messages=warning" psql -U "$POSTGRES_USER" -d "${1:-$POSTGRES_DB}" -v ON_ERROR_STOP=1 -qAtX' sh "$@"
}

latest="$(ls -1t "$dir"/wedding-*.dump 2>/dev/null | head -n 1 || true)"
[ -n "$latest" ] || fail "no dump in $dir"
# A stale dump means the nightly job stopped, which is the failure this check exists to catch.
[ -n "$(find "$latest" -mmin -"$((max_age_hours * 60))")" ] || fail "latest dump $latest is older than ${max_age_hours}h"

cleanup() { psql '' <<<"DROP DATABASE IF EXISTS $scratch WITH (FORCE)" >/dev/null || true; }
trap cleanup EXIT
cleanup
psql '' <<<"CREATE DATABASE $scratch" >/dev/null

docker compose -f "$compose_file" exec -T postgres \
	sh -c 'pg_restore -U "$POSTGRES_USER" -d "$1" --no-owner --exit-on-error' sh "$scratch" <"$latest" ||
	fail "pg_restore of $latest"

tables="SELECT table_schema || '.' || table_name FROM information_schema.tables
	WHERE table_schema IN ('public', 'drizzle', 'pgboss') ORDER BY 1"
live="$(psql '' <<<"$tables")"
restored="$(psql "$scratch" <<<"$tables")"
[ "$live" = "$restored" ] || fail "restored tables differ from the live schema"

counts="SELECT 'parties=' || (SELECT count(*) FROM parties) || ' guests=' || (SELECT count(*) FROM guests)
	|| ' rsvps=' || (SELECT count(*) FROM rsvps)"
echo "$(date -u +%FT%TZ) restore check ok $latest $(psql "$scratch" <<<"$counts")"
