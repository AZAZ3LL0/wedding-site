#!/usr/bin/env bash
# Nightly dump of the app database, run by cron as root (deploy/wedding-backup.cron).
# pg_dump runs inside the postgres container, so the dump always matches the server version.
set -euo pipefail

compose_file="${COMPOSE_FILE:-/srv/wedding/shared/postgres.compose.yml}"
dir="${BACKUP_DIR:-/srv/wedding/backups}"
keep_days="${KEEP_DAYS:-14}"

install -d -m 700 "$dir"
target="$dir/wedding-$(date -u +%Y%m%d-%H%M%S).dump"

# Write to a temp name first: a dump cut short by a crash never looks like a finished backup.
docker compose -f "$compose_file" exec -T postgres \
	sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' >"$target.part"
mv "$target.part" "$target"
chmod 600 "$target"

find "$dir" -name 'wedding-*.dump' -mtime +"$keep_days" -delete
find "$dir" -name 'wedding-*.dump.part' -mmin +60 -delete
echo "$(date -u +%FT%TZ) backup $target $(du -h "$target" | cut -f1)"
