#!/usr/bin/env bash
# Points the bot's webhook at this site. Safe to rerun: setWebhook replaces the previous one,
# so a rotated TELEGRAM_WEBHOOK_SECRET takes effect on the next release.
# Reads the app env (release.sh sources shared/.env before calling it).
set -euo pipefail

if [ "${USE_FAKE_TELEGRAM:-true}" != 'false' ]; then
	echo 'telegram: fake client, webhook left alone'
	exit 0
fi

: "${TELEGRAM_BOT_TOKEN:?}" "${TELEGRAM_WEBHOOK_SECRET:?}" "${PUBLIC_SITE_URL:?}"

# The token is part of the API URL. Feeding curl its config on stdin keeps it out of `ps`.
api() {
	curl -fsS --max-time 15 -K - <<-CURL
		url = "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/$1"
		${2:-}
	CURL
}

# The bot only reads private messages, so Telegram need not deliver anything else.
api setWebhook "$(
	printf 'data-urlencode = "url=%s/api/telegram"\n' "${PUBLIC_SITE_URL%/}"
	printf 'data-urlencode = "secret_token=%s"\n' "$TELEGRAM_WEBHOOK_SECRET"
	printf 'data-urlencode = "allowed_updates=[\\"message\\"]"\n'
)" >/dev/null

# getWebhookInfo carries the last delivery error, which is what breaks when Cloudflare blocks Telegram.
info="$(api getWebhookInfo)"
echo "telegram: webhook set, $(printf '%s' "$info" | grep -o '"url":"[^"]*"')"
if printf '%s' "$info" | grep -q '"last_error_message"'; then
	echo "telegram: last delivery error $(printf '%s' "$info" | grep -o '"last_error_message":"[^"]*"')" >&2
fi
