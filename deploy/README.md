# Deploy

The VPS also runs a live VPN (xray on 443/TCP, hysteria on 443/UDP, panel nginx on 80 and 8443). Do not touch those ports. Reboot only from the hosting panel.

```
guest → https://wedding.alina-samat.ru (Cloudflare, SSL Full)
      → Origin Rule rewrites the port to 2096
      → Caddy on the host, tls internal
      → node build/index.js on 127.0.0.1:3000 (systemd unit wedding)
      → PostgreSQL 16 in Docker on 127.0.0.1:5432
```

A merge into `main` runs `.github/workflows/deploy.yml`: build on the runner, rsync into `/srv/wedding/releases/<sha>`, then `release.sh` installs dependencies, switches `/srv/wedding/current`, restarts the unit and rolls back if the app does not answer.

## Layout on the server

```
/srv/wedding/
  current -> releases/<sha>
  releases/<sha>/
  shared/.env               app config, mode 600, owner deploy
  shared/postgres.env       POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, mode 600
  shared/postgres.compose.yml
```

## One-time bootstrap (as root)

`bootstrap.sh` automates the steps below and is safe to rerun. It stops the old `wedding-invite` stack without removing its volumes.

```bash
scp -r deploy root@<host>:/tmp/wedding-deploy
ssh root@<host> 'bash /tmp/wedding-deploy/bootstrap.sh "<deploy public key>"'
```

Steps:

1. Node 24 from the official tarball into `/usr/local`, verified against `SHASUMS256.txt`, then `npm i -g pnpm@10`. Install `rsync`.
2. User `deploy` with the Actions public key in `~/.ssh/authorized_keys` and `/etc/sudoers.d/wedding`:
   ```
   deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart wedding
   ```
3. `/srv/wedding/{releases,shared}` owned by `deploy`. Fill `shared/.env` and `shared/postgres.env`.
4. `docker compose -f /srv/wedding/shared/postgres.compose.yml up -d`.
5. `deploy/Caddyfile` to `/etc/caddy/Caddyfile`, then `apt install caddy`.
6. `deploy/wedding.service` to `/etc/systemd/system/`, `systemctl daemon-reload && systemctl enable wedding`.
7. Allow 2096/tcp in ufw only from Cloudflare ranges (https://www.cloudflare.com/ips-v4, https://www.cloudflare.com/ips-v6).

GitHub secrets for the `production` environment: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS` (output of `ssh-keyscan -t ed25519 <host>`).

## Operations

```bash
systemctl status wedding
journalctl -u wedding -n 100
ls -1t /srv/wedding/releases                        # manual rollback: point current at an older one
ln -sfn /srv/wedding/releases/<sha> /srv/wedding/current && systemctl restart wedding
```
