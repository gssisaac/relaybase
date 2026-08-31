#!/usr/bin/env bash
# Fail the release pipeline unless the main binary is a fat Mach-O (x86_64 + arm64).
set -euo pipefail

APP_BIN="${1:-}"
if [[ -z "$APP_BIN" || ! -f "$APP_BIN" ]]; then
  echo "✗ verify-universal-app: missing binary: ${APP_BIN:-<unset>}" >&2
  exit 1
fi

INFO="$(lipo -info "$APP_BIN" 2>&1)" || {
  echo "✗ verify-universal-app: lipo failed on $APP_BIN" >&2
  exit 1
}

if [[ "$INFO" != *x86_64* || "$INFO" != *arm64* ]]; then
  echo "✗ Not a Universal macOS release binary." >&2
  echo "  lipo: $INFO" >&2
  echo "  Expected both x86_64 and arm64." >&2
  echo "  Do not run \`pnpm run build:host\` or bare \`tauri build\` for release." >&2
  echo "  Use: cd desktop && RELAYBASE_NOTARIZE=1 pnpm run build:macos" >&2
  exit 1
fi

echo "→ Universal binary OK ($INFO)"
