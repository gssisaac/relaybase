#!/usr/bin/env bash
# Build signed (and notarized when configured) Relaybase macOS DMG via Tauri.
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

# shellcheck source=/dev/null
source "$ROOT/scripts/deploy/load-apple-signing.sh"

# Adapt kloy env name if present
export RELAYBASE_NOTARIZE="${RELAYBASE_NOTARIZE:-${KLOY_NOTARIZE:-0}}"

echo "→ pnpm install"
"$PNPM" install

export APPLE_SIGNING_IDENTITY
export APPLE_TEAM_ID

TAURI_ARGS=(build --bundles app,dmg)
if [[ "${RELAYBASE_NOTARIZE:-0}" == "1" ]]; then
  echo "→ pnpm run tauri build (sign + notarize)"
  unset APPLE_ID APPLE_PASSWORD APPLE_APP_SPECIFIC_PASSWORD NOTARYTOOL_PROFILE
  if [[ -n "${APPLE_API_ISSUER:-}" && -n "${APPLE_API_KEY:-}" && -n "${APPLE_API_KEY_PATH:-}" ]]; then
    export APPLE_API_ISSUER APPLE_API_KEY APPLE_API_KEY_PATH
  elif [[ -n "${APPLE_ID:-}" && -n "${APPLE_PASSWORD:-}" ]]; then
    export APPLE_ID APPLE_PASSWORD
  fi
else
  echo "→ pnpm run tauri build (sign only; notarization skipped)"
  unset APPLE_ID APPLE_PASSWORD APPLE_APP_SPECIFIC_PASSWORD APPLE_API_KEY APPLE_API_ISSUER APPLE_API_KEY_PATH NOTARYTOOL_PROFILE
fi

echo "→ Signing identity: $APPLE_SIGNING_IDENTITY"
"$PNPM" exec tauri "${TAURI_ARGS[@]}"

echo "→ Bundle output:"
find src-tauri/target/release/bundle -maxdepth 3 -type f \( -name '*.dmg' -o -name '*.app' \) 2>/dev/null | head -20 || true

if [[ "${RELAYBASE_NOTARIZE:-0}" == "1" ]]; then
  bash "$ROOT/scripts/deploy/notarize-dmg.sh"
fi

echo "✓ Relaybase macOS build complete"
