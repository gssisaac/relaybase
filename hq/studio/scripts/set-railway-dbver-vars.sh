#!/usr/bin/env bash
# Set Railway variables for hq-relaybase-studio-dbver (run after `railway link`).
set -euo pipefail

SERVICE="${RAILWAY_SERVICE:-hq-relaybase-studio-dbver}"
WEB_URL="${HQ_AUTH_APP_URL:-https://hq-relaybase-web-app-dbver.gssisaac.workers.dev}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required (use postgres.railway.internal:5432/relaybase on Railway)." >&2
  exit 1
fi

if [[ -z "${HQ_JWT_SECRET:-}" ]]; then
  echo "HQ_JWT_SECRET is required for production auth." >&2
  exit 1
fi

railway variables --service "$SERVICE" set \
  "DATABASE_URL=${DATABASE_URL}" \
  "HQ_JWT_SECRET=${HQ_JWT_SECRET}" \
  "HQ_AUTH_APP_URL=${WEB_URL}" \
  "STUDIO_PUBLIC_BASE_URL=${WEB_URL}" \
  "NODE_ENV=production" \
  "PORT=8080"

echo "Variables set on service ${SERVICE}."
