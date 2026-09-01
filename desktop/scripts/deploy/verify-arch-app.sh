#!/usr/bin/env bash
# Fail the release pipeline unless the main binary is a single-arch Mach-O.
# Usage: verify-arch-app.sh <binary> <arm64|x86_64>
set -euo pipefail

APP_BIN="${1:-}"
EXPECT="${2:-}"
if [[ -z "$APP_BIN" || ! -f "$APP_BIN" ]]; then
  echo "✗ verify-arch-app: missing binary: ${APP_BIN:-<unset>}" >&2
  exit 1
fi
if [[ "$EXPECT" != "arm64" && "$EXPECT" != "x86_64" ]]; then
  echo "✗ verify-arch-app: expected arch arm64 or x86_64, got: ${EXPECT:-<unset>}" >&2
  exit 1
fi

INFO="$(lipo -info "$APP_BIN" 2>&1)" || {
  echo "✗ verify-arch-app: lipo failed on $APP_BIN" >&2
  exit 1
}

# Reject Universal fat binaries — releases are per-arch only.
if [[ "$INFO" == *x86_64* && "$INFO" == *arm64* ]]; then
  echo "✗ Unexpected Universal (fat) binary — per-arch releases only." >&2
  echo "  lipo: $INFO" >&2
  exit 1
fi

if [[ "$INFO" != *"$EXPECT"* ]]; then
  echo "✗ Wrong architecture for this release." >&2
  echo "  lipo: $INFO" >&2
  echo "  Expected: $EXPECT" >&2
  exit 1
fi

echo "→ Arch binary OK ($INFO)"
