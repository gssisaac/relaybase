#!/usr/bin/env bash
# Upload large release binaries (DMG + updater tar.gz) to Cloudflare R2.
# Small metadata (latest.json, .sig, artifacts.json) stays in git under website/public/release/.
#
# Per-arch keys:
#   Relaybase.<version>.aarch64.dmg
#   Relaybase.<version>.aarch64.app.tar.gz
#   Relaybase.<version>.x86_64.dmg
#   …
#
# Env: RELAYBASE_MAC_ARCH=aarch64|x86_64 (default aarch64)
# Requires CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID (or wrangler OAuth).
# Bucket: relaybase-releases, served at https://download.relaybase.xyz/<key>
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RELEASE_DIR="$ROOT/../hq/website/public/release"
BUCKET="${RELAYBASE_RELEASE_R2_BUCKET:-relaybase-releases}"
META_PATH="$RELEASE_DIR/artifacts.json"
IMMUTABLE_CACHE_CONTROL="public, max-age=31536000, immutable"
CDN_HOST="${DOWNLOAD_CDN_BASE_URL:-https://download.relaybase.xyz}"
CDN_HOST="${CDN_HOST%/}"

ARCH_RAW="${RELAYBASE_MAC_ARCH:-aarch64}"
case "$ARCH_RAW" in
  aarch64|arm64) ARCH="aarch64"; RUST_TARGET="aarch64-apple-darwin" ;;
  x86_64|intel|amd64) ARCH="x86_64"; RUST_TARGET="x86_64-apple-darwin" ;;
  *)
    echo "✗ Unknown RELAYBASE_MAC_ARCH=$ARCH_RAW (use aarch64 or x86_64)" >&2
    exit 1
    ;;
esac

if [[ ! -d "$RELEASE_DIR" ]]; then
  echo "✗ Missing $RELEASE_DIR" >&2
  exit 1
fi

VERSION="${RELAYBASE_VERSION:-$(node -p "require('$ROOT/src-tauri/tauri.conf.json').version")}"
CARGO_TARGET="${CARGO_TARGET_DIR:-$ROOT/src-tauri/target}"
BUNDLE="$CARGO_TARGET/$RUST_TARGET/release/bundle"
STAGE="$(mktemp -d "${TMPDIR:-/tmp}/relaybase-release.XXXXXX")"
cleanup_stage() { rm -rf "$STAGE"; }
trap cleanup_stage EXIT

DMG_NAME="Relaybase.${VERSION}.${ARCH}.dmg"
TGZ_NAME="Relaybase.${VERSION}.${ARCH}.app.tar.gz"
SIG_NAME="${TGZ_NAME}.sig"

stage_or_release() {
  local dest_name="$1"
  local release_path="$2"
  shift 2
  local dest="$STAGE/$dest_name"
  if [[ -f "$release_path" ]]; then
    cp "$release_path" "$dest"
    echo "$dest"
    return 0
  fi
  local src
  for src in "$@"; do
    if [[ -n "$src" && -f "$src" ]]; then
      cp "$src" "$dest"
      echo "$dest"
      return 0
    fi
  done
  echo "$release_path"
}

BUNDLE_DMG="$(find "$BUNDLE/dmg" -name '*.dmg' 2>/dev/null | head -1 || true)"
DMG="$(stage_or_release "$DMG_NAME" "$RELEASE_DIR/$DMG_NAME" "$BUNDLE_DMG")"
TGZ="$(stage_or_release "$TGZ_NAME" "$RELEASE_DIR/$TGZ_NAME" "$BUNDLE/macos/Relaybase.app.tar.gz")"
SIG="$(stage_or_release "$SIG_NAME" "$RELEASE_DIR/$SIG_NAME" "$BUNDLE/macos/Relaybase.app.tar.gz.sig")"

WEBSITE_DIR="$(cd "$ROOT/../hq/website" && pwd)"
# Prefer website wrangler if present; otherwise use desktop's pnpm dlx.
if [[ -f "$WEBSITE_DIR/package.json" ]]; then
  WRANGLER=(pnpm --dir "$WEBSITE_DIR" dlx wrangler@4)
else
  WRANGLER=(pnpm --dir "$ROOT" dlx wrangler@4)
fi

# R2 bucket lives on the website Worker account. desktop/.env may hold a
# different CLOUDFLARE_ACCOUNT_ID (other CF accounts). Prefer wrangler.jsonc.
if [[ -z "${RELAYBASE_RELEASE_CF_ACCOUNT_ID:-}" && -f "$WEBSITE_DIR/wrangler.jsonc" ]]; then
  RELAYBASE_RELEASE_CF_ACCOUNT_ID="$(grep -o '"account_id": "[^"]*"' "$WEBSITE_DIR/wrangler.jsonc" | head -1 | cut -d'"' -f4 || true)"
fi
if [[ -n "${RELAYBASE_RELEASE_CF_ACCOUNT_ID:-}" ]]; then
  export CLOUDFLARE_ACCOUNT_ID="$RELAYBASE_RELEASE_CF_ACCOUNT_ID"
  echo "→ R2 account: $CLOUDFLARE_ACCOUNT_ID (website wrangler / RELAYBASE_RELEASE_CF_ACCOUNT_ID)"
fi
if [[ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  echo "✗ CLOUDFLARE_ACCOUNT_ID is empty" >&2
  exit 1
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

echo "→ Uploading release ${VERSION} (${ARCH}) binaries to R2 bucket ${BUCKET} (CDN: ${CDN_HOST})"
upload_one "$DMG" "application/x-apple-diskimage"
upload_one "$TGZ" "application/gzip"
upload_one "$SIG" "text/plain" 0

if [[ -f "$SIG" ]]; then
  cp "$SIG" "$RELEASE_DIR/$SIG_NAME"
fi

RELEASE_DIR="$RELEASE_DIR" META_PATH="$META_PATH" VERSION="$VERSION" ARCH="$ARCH" STAGE_DIR="$STAGE" node <<'NODE'
const fs = require('fs');
const path = require('path');
const dir = process.env.RELEASE_DIR;
const metaPath = process.env.META_PATH;
const version = process.env.VERSION;
const arch = process.env.ARCH;
const existing = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : {};
const staged = process.env.STAGE_DIR || '';
for (const name of [
  `Relaybase.${version}.${arch}.dmg`,
  `Relaybase.${version}.${arch}.app.tar.gz`,
]) {
  const p = [staged && path.join(staged, name), path.join(dir, name)].find((c) => c && fs.existsSync(c));
  if (!p) continue;
  existing[name] = { sizeBytes: fs.statSync(p).size, version, arch };
}
fs.writeFileSync(metaPath, JSON.stringify(existing, null, 2) + '\n');
console.log('[upload-release-r2] Wrote', metaPath);
NODE

echo "✓ R2 upload complete (public via ${CDN_HOST}/... immediately, no website deploy needed)"
