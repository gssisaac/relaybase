#!/usr/bin/env bash
# Upload large release binaries (DMG + updater tar.gz) to Cloudflare R2.
# Small metadata (latest.json, .sig, artifacts.json) stays in git under website/public/release/.
#
# Requires CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID (or wrangler OAuth).
# Bucket: relaybase-releases, served at https://download.relaybase.xyz/<key>
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RELEASE_DIR="$ROOT/../../kembo/website/public/release"
BUCKET="${RELAYBASE_RELEASE_R2_BUCKET:-relaybase-releases}"
META_PATH="$RELEASE_DIR/artifacts.json"
IMMUTABLE_CACHE_CONTROL="public, max-age=31536000, immutable"
CDN_HOST="${DOWNLOAD_CDN_BASE_URL:-https://download.relaybase.xyz}"
CDN_HOST="${CDN_HOST%/}"

if [[ ! -d "$RELEASE_DIR" ]]; then
  echo "✗ Missing $RELEASE_DIR" >&2
  exit 1
fi

VERSION="$(node -p "require('$ROOT/src-tauri/tauri.conf.json').version")"
DMG="$RELEASE_DIR/Relaybase.${VERSION}.dmg"
TGZ="$RELEASE_DIR/Relaybase.${VERSION}.app.tar.gz"
SIG="$RELEASE_DIR/Relaybase.${VERSION}.app.tar.gz.sig"

# Prefer website wrangler if present; otherwise use desktop's pnpm dlx.
if [[ -f "$ROOT/../../kembo/website/package.json" ]]; then
  WRANGLER=(pnpm --dir "$ROOT/../../kembo/website" dlx wrangler@4)
else
  WRANGLER=(pnpm --dir "$ROOT" dlx wrangler@4)
fi

upload_one() {
  local file="$1"
  local content_type="$2"
  local attach="${3:-1}"
  local key
  key="$(basename "$file")"
  if [[ ! -f "$file" ]]; then
    echo "⚠ skip missing $key"
    return 0
  fi
  echo "→ R2 put ${BUCKET}/${key} ($(du -h "$file" | cut -f1), Cache-Control: ${IMMUTABLE_CACHE_CONTROL})"
  local args=(r2 object put "${BUCKET}/${key}" \
    --file="$file" \
    --content-type="$content_type" \
    --cache-control="$IMMUTABLE_CACHE_CONTROL" \
    --remote)
  if [[ "$attach" == "1" ]]; then
    args+=(--content-disposition="attachment; filename=\"${key}\"")
  fi
  "${WRANGLER[@]}" "${args[@]}"
}

echo "→ Uploading release ${VERSION} binaries to R2 bucket ${BUCKET} (CDN: ${CDN_HOST})"
upload_one "$DMG" "application/x-apple-diskimage"
upload_one "$TGZ" "application/gzip"
upload_one "$SIG" "text/plain" 0

RELEASE_DIR="$RELEASE_DIR" META_PATH="$META_PATH" VERSION="$VERSION" node <<'NODE'
const fs = require('fs');
const path = require('path');
const dir = process.env.RELEASE_DIR;
const metaPath = process.env.META_PATH;
const version = process.env.VERSION;
const existing = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : {};
for (const name of [`Relaybase.${version}.dmg`, `Relaybase.${version}.app.tar.gz`]) {
  const p = path.join(dir, name);
  if (!fs.existsSync(p)) continue;
  existing[name] = { sizeBytes: fs.statSync(p).size, version };
}
fs.writeFileSync(metaPath, JSON.stringify(existing, null, 2) + '\n');
console.log('[upload-release-r2] Wrote', metaPath);
NODE

echo "✓ R2 upload complete (public via ${CDN_HOST}/... immediately, no website deploy needed)"
