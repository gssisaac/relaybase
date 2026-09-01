#!/usr/bin/env bash
# Notarize and staple DMGs (Tauri notarizes the .app; the .dmg needs its own pass).
# Usage: notarize-dmg.sh [dmg-dir]
# Default dmg-dir: aarch64-apple-darwin release bundle (or RELAYBASE_MAC_ARCH).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CARGO_TARGET="${CARGO_TARGET_DIR:-$ROOT/src-tauri/target}"

ARCH="${RELAYBASE_MAC_ARCH:-aarch64}"
case "$ARCH" in
  aarch64|arm64) RUST_TARGET="aarch64-apple-darwin" ;;
  x86_64|intel|amd64) RUST_TARGET="x86_64-apple-darwin" ;;
  *)
    echo "✗ Unknown RELAYBASE_MAC_ARCH=$ARCH (use aarch64 or x86_64)" >&2
    exit 1
    ;;
esac

DMG_DIR="${1:-$CARGO_TARGET/$RUST_TARGET/release/bundle/dmg}"

if [[ ! -d "$DMG_DIR" ]]; then
  echo "✗ DMG directory not found: $DMG_DIR" >&2
  exit 1
fi

shopt -s nullglob
DMGS=("$DMG_DIR"/*.dmg)
if [[ ${#DMGS[@]} -eq 0 ]]; then
  echo "✗ No .dmg files in $DMG_DIR" >&2
  exit 1
fi

for dmg in "${DMGS[@]}"; do
  echo "→ Notarizing $(basename "$dmg")"
  if [[ -n "${APPLE_API_ISSUER:-}" && -n "${APPLE_API_KEY:-}" && -n "${APPLE_API_KEY_PATH:-}" ]]; then
    xcrun notarytool submit "$dmg" \
      --issuer "$APPLE_API_ISSUER" \
      --key-id "$APPLE_API_KEY" \
      --key "$APPLE_API_KEY_PATH" \
      --wait
  elif [[ -n "${NOTARYTOOL_PROFILE:-}" ]]; then
    xcrun notarytool submit "$dmg" --keychain-profile "$NOTARYTOOL_PROFILE" --wait
  elif [[ -n "${APPLE_ID:-}" && -n "${APPLE_PASSWORD:-}" ]]; then
    xcrun notarytool submit "$dmg" \
      --apple-id "$APPLE_ID" \
      --password "$APPLE_PASSWORD" \
      --team-id "$APPLE_TEAM_ID" \
      --wait
  else
    echo "✗ Notarization credentials missing" >&2
    exit 1
  fi
  echo "→ Stapling $(basename "$dmg")"
  xcrun stapler staple "$dmg"
  xcrun stapler validate "$dmg"
done

echo "✓ DMG notarization complete"
