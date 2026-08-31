#!/usr/bin/env bash
# Build signed (and notarized when configured) Universal Relaybase macOS DMG via Tauri.
# Apple credentials: ops-dashboard Release settings, scripts/deploy/apple-signing.env, or .env
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

setup_toolchain() {
  if [[ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]]; then
    # shellcheck source=/dev/null
    source "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
    nvm use 22 2>/dev/null || nvm use --lts 2>/dev/null || true
    if command -v node >/dev/null 2>&1; then
      export PATH="$(dirname "$(command -v node)"):$PATH"
    fi
  fi
  export PATH="/opt/homebrew/bin:${PATH:-}"
  corepack enable >/dev/null 2>&1 || true
  PNPM="$(command -v pnpm || true)"
  if [[ -z "$PNPM" ]]; then
    echo "✗ pnpm not found on PATH (run: corepack enable)"
    exit 1
  fi
  echo "→ node: $(node -v)"
  echo "→ pnpm: $($PNPM -v)"
}

setup_toolchain

# Merge desktop/.env (Cloudflare + updater signing) when present
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ROOT/.env"
  set +a
  echo "→ Loaded $ROOT/.env"
fi

# shellcheck source=/dev/null
source "$ROOT/scripts/deploy/load-apple-signing.sh"

export RELAYBASE_NOTARIZE="${RELAYBASE_NOTARIZE:-${KLOY_NOTARIZE:-0}}"

if [[ -n "${TAURI_SIGNING_PRIVATE_KEY_PATH:-}" && -z "${TAURI_SIGNING_PRIVATE_KEY:-}" ]]; then
  TAURI_KEY_ABS="$TAURI_SIGNING_PRIVATE_KEY_PATH"
  if [[ "$TAURI_KEY_ABS" != /* ]]; then
    TAURI_KEY_ABS="$ROOT/$TAURI_KEY_ABS"
  fi
  if [[ -f "$TAURI_KEY_ABS" ]]; then
    echo "→ Updater signing key: $TAURI_SIGNING_PRIVATE_KEY_PATH"
  else
    echo "⚠ TAURI_SIGNING_PRIVATE_KEY_PATH not found: $TAURI_KEY_ABS (updater bundles may be unsigned)"
  fi
fi

echo "→ rustup targets aarch64-apple-darwin x86_64-apple-darwin"
if ! command -v rustup >/dev/null 2>&1; then
  echo "✗ rustup not found on PATH"
  exit 1
fi
rustup target add aarch64-apple-darwin x86_64-apple-darwin

echo "→ pnpm install"
"$PNPM" install

export APPLE_SIGNING_IDENTITY
export APPLE_TEAM_ID

CARGO_TARGET="${CARGO_TARGET_DIR:-$ROOT/src-tauri/target}"
BUNDLE_ROOT="$CARGO_TARGET/universal-apple-darwin/release/bundle"
export CARGO_TARGET_DIR="$CARGO_TARGET"
TAURI_ARGS=(build --target universal-apple-darwin --bundles app,dmg)
if [[ "${RELAYBASE_NOTARIZE:-0}" == "1" ]]; then
  echo "→ pnpm run tauri build --target universal-apple-darwin (sign + notarize)"
  unset APPLE_ID APPLE_PASSWORD APPLE_APP_SPECIFIC_PASSWORD NOTARYTOOL_PROFILE
  if [[ -n "${APPLE_API_ISSUER:-}" && -n "${APPLE_API_KEY:-}" && -n "${APPLE_API_KEY_PATH:-}" ]]; then
    export APPLE_API_ISSUER APPLE_API_KEY APPLE_API_KEY_PATH
  elif [[ -n "${APPLE_ID:-}" && -n "${APPLE_PASSWORD:-}" ]]; then
    export APPLE_ID APPLE_PASSWORD
  fi
else
  echo "→ pnpm run tauri build --target universal-apple-darwin (sign only; notarization skipped)"
  unset APPLE_ID APPLE_PASSWORD APPLE_APP_SPECIFIC_PASSWORD APPLE_API_KEY APPLE_API_ISSUER APPLE_API_KEY_PATH NOTARYTOOL_PROFILE
fi

echo "→ Signing identity: $APPLE_SIGNING_IDENTITY"

# `tauri build` updater signing reads TAURI_SIGNING_PRIVATE_KEY (inline), not PATH alone.
if [[ -n "${TAURI_SIGNING_PRIVATE_KEY_PATH:-}" && -z "${TAURI_SIGNING_PRIVATE_KEY:-}" ]]; then
  TAURI_KEY_ABS="$TAURI_SIGNING_PRIVATE_KEY_PATH"
  if [[ "$TAURI_KEY_ABS" != /* ]]; then
    TAURI_KEY_ABS="$ROOT/$TAURI_KEY_ABS"
  fi
  if [[ -f "$TAURI_KEY_ABS" ]]; then
    export TAURI_SIGNING_PRIVATE_KEY="$(tr -d '\n' < "$TAURI_KEY_ABS")"
    unset TAURI_SIGNING_PRIVATE_KEY_PATH
  fi
fi

"$PNPM" exec tauri "${TAURI_ARGS[@]}"

echo "→ Bundle output:"
find "$BUNDLE_ROOT" -maxdepth 3 -type f \( -name '*.dmg' -o -name '*.app' \) 2>/dev/null | head -20 || true

VERSION="$(node -p "require('./src-tauri/tauri.conf.json').version")"
APP_BIN="$BUNDLE_ROOT/macos/Relaybase.app/Contents/MacOS/Relaybase"
if [[ -f "$APP_BIN" ]]; then
  bash "$ROOT/scripts/deploy/verify-universal-app.sh" "$APP_BIN"
fi

DMG="$(find "$BUNDLE_ROOT/dmg" -name "Relaybase_${VERSION}_*.dmg" 2>/dev/null | head -1)"
if [[ -z "$DMG" || ! -f "$DMG" ]]; then
  DMG="$(find "$BUNDLE_ROOT/dmg" -name '*.dmg' 2>/dev/null | head -1)"
fi

if [[ -z "$DMG" || ! -f "$DMG" ]]; then
  echo "✗ No .dmg found under $BUNDLE_ROOT/dmg"
  exit 1
fi

if [[ "${RELAYBASE_NOTARIZE:-0}" == "1" ]]; then
  bash "$ROOT/scripts/deploy/notarize-dmg.sh"
fi

echo "→ Verifying DMG signature"
codesign -dv --verbose=2 "$DMG" 2>&1 | head -15 || true
if [[ "${RELAYBASE_NOTARIZE:-0}" == "1" ]]; then
  echo "→ Checking notarization"
  spctl -a -vv -t install "$DMG" 2>&1 || true
fi

echo "→ Syncing DMG and updater artifacts to website/public/release"
node "$ROOT/scripts/sync-release-artifacts.mjs"

LATEST_JSON="$ROOT/../hq/website/public/release/latest.json"
if [[ ! -f "$LATEST_JSON" ]]; then
  echo "✗ hq/website/public/release/latest.json was not created."
  echo "  Updater bundles (.app.tar.gz + .sig) are required for in-app auto-update."
  echo "  Ensure TAURI_SIGNING_PRIVATE_KEY_PATH is set and createUpdaterArtifacts is true."
  exit 1
fi
echo "→ Updater manifest: hq/website/public/release/latest.json"

if [[ -n "${CLOUDFLARE_API_TOKEN:-}" || -n "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  echo "→ Uploading release binaries to Cloudflare R2"
  bash "$ROOT/scripts/deploy/upload-release-r2.sh"
else
  echo "⚠ CLOUDFLARE_API_TOKEN/ACCOUNT_ID unset — skipping R2 upload."
  echo "  Large DMG/tar.gz must be uploaded before downloads/updater will work."
fi

echo "✓ Relaybase macOS build complete"
