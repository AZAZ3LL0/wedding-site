#!/usr/bin/env bash
# One-time, idempotent VPS setup. Run as root from a checkout of the repo:
#   sudo bash deploy/bootstrap.sh "<deploy public key>"
# Never touches ports 80/443 or the VPN containers.
set -euo pipefail

deploy_pubkey="${1:?pass the public key for the deploy user}"
here="$(cd "$(dirname "$0")" && pwd)"
root=/srv/wedding
export DEBIAN_FRONTEND=noninteractive

step() { printf '\n==> %s\n' "$1"; }

step 'node 24, pnpm, rsync'
if ! node -v 2>/dev/null | grep -q '^v24\.'; then
	version=$(curl -fsSL https://nodejs.org/dist/index.json |
		python3 -c "import sys, json; print(next(r['version'] for r in json.load(sys.stdin) if r['version'].startswith('v24.')))")
	tarball="node-$version-linux-x64.tar.xz"
	tmp=$(mktemp -d)
	curl -fsSL -o "$tmp/$tarball" "https://nodejs.org/dist/$version/$tarball"
	(cd "$tmp" && curl -fsSL "https://nodejs.org/dist/$version/SHASUMS256.txt" | grep " $tarball\$" | sha256sum -c -)
	tar -xJf "$tmp/$tarball" -C /usr/local --strip-components=1 --exclude CHANGELOG.md --exclude README.md --exclude LICENSE
	rm -rf "$tmp"
fi
command -v pnpm >/dev/null || npm i -g pnpm@10
command -v rsync >/dev/null || apt-get install -y -qq rsync
node -v && pnpm -v

step 'deploy user'
id deploy >/dev/null 2>&1 || useradd --create-home --shell /bin/bash deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
grep -qxF "$deploy_pubkey" /home/deploy/.ssh/authorized_keys 2>/dev/null ||
	printf '%s\n' "$deploy_pubkey" >>/home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
printf 'deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart wedding\n' >/etc/sudoers.d/wedding
chmod 440 /etc/sudoers.d/wedding
visudo -cf /etc/sudoers.d/wedding

step 'directories and secrets'
install -d -o deploy -g deploy "$root" "$root/releases"
install -d -m 700 -o deploy -g deploy "$root/shared"
install -m 644 "$here/postgres.compose.yml" "$root/shared/postgres.compose.yml"
if [ ! -f "$root/shared/postgres.env" ]; then
	pg_password=$(openssl rand -hex 24)
	install -m 600 -o deploy -g deploy /dev/null "$root/shared/postgres.env"
	printf 'POSTGRES_USER=wedding\nPOSTGRES_PASSWORD=%s\nPOSTGRES_DB=wedding\n' "$pg_password" >"$root/shared/postgres.env"
	install -m 600 -o deploy -g deploy /dev/null "$root/shared/.env"
	cat >"$root/shared/.env" <<-ENV
		DATABASE_URL=postgres://wedding:$pg_password@127.0.0.1:5432/wedding
		PUBLIC_SITE_URL=https://wedding.alina-samat.ru
		TELEGRAM_BOT_TOKEN=
		TELEGRAM_BOT_USERNAME=
		TELEGRAM_WEBHOOK_SECRET=$(openssl rand -hex 32)
		TELEGRAM_ADMIN_CHAT_ID=
		ADMIN_PASSWORD=$(openssl rand -base64 18)
		SESSION_SECRET=$(openssl rand -hex 32)
		USE_FAKE_TELEGRAM=true
	ENV
fi

step 'stop the old wedding-invite stack (volumes stay)'
if [ -f /srv/wedding-invite/docker-compose.yml ]; then
	(cd /srv/wedding-invite && docker compose down)
fi

step 'postgres 16 on loopback'
docker compose -f "$root/shared/postgres.compose.yml" up -d --wait

step 'nightly database backup'
install -m 755 "$here/backup.sh" /usr/local/sbin/wedding-backup
install -m 755 "$here/restore-check.sh" /usr/local/sbin/wedding-restore-check
install -d -m 700 "$root/backups"
install -m 644 "$here/wedding-backup.cron" /etc/cron.d/wedding-backup

step 'caddy on 2096'
install -d /etc/caddy
install -m 644 "$here/Caddyfile" /etc/caddy/Caddyfile
# confold keeps our Caddyfile instead of the package default that listens on :80.
dpkg -s caddy >/dev/null 2>&1 || apt-get install -y -qq -o Dpkg::Options::=--force-confold caddy
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl enable caddy
systemctl reload-or-restart caddy

step 'systemd unit'
install -m 644 "$here/wedding.service" /etc/systemd/system/wedding.service
systemctl daemon-reload
systemctl enable wedding

step 'firewall: 2096 from Cloudflare only'
for cidr in $(curl -fsSL https://www.cloudflare.com/ips-v4) $(curl -fsSL https://www.cloudflare.com/ips-v6); do
	ufw allow proto tcp from "$cidr" to any port 2096 comment cloudflare >/dev/null
done

step 'check'
ss -tlnp | grep -E ':(443|2096|3000|5432) ' || true
echo 'Done. The first merge into main deploys the app.'
