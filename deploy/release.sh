#!/usr/bin/env bash
# Activates an uploaded release on the VPS. Runs as the deploy user from the release directory.
set -euo pipefail

sha="$1"
root=/srv/wedding
release="$root/releases/$sha"
previous="$(readlink -f "$root/current" 2>/dev/null || true)"

cd "$release"
pnpm install --frozen-lockfile

activate() {
	ln -sfn "$1" "$root/current.next"
	mv -Tf "$root/current.next" "$root/current"
	sudo /usr/bin/systemctl restart wedding
}

healthy() {
	for _ in $(seq 1 30); do
		if curl -fsS -o /dev/null http://127.0.0.1:3000/robots.txt; then
			return 0
		fi
		sleep 1
	done
	return 1
}

activate "$release"

if ! healthy; then
	echo "release $sha failed the health check" >&2
	if [ -n "$previous" ] && [ "$previous" != "$release" ]; then
		echo "rolling back to $previous" >&2
		activate "$previous"
	fi
	exit 1
fi

# Keep a few releases around for manual rollback.
ls -1dt "$root"/releases/*/ | tail -n +6 | xargs -r rm -rf
echo "release $sha is live"
