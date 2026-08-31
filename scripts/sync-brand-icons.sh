#!/usr/bin/env bash
# Convert a master Relaybase icon into website / app / Mac (Tauri) / mobile assets.
#
# Usage:
#   ./scripts/sync-brand-icons.sh [path/to/icon.png]
#
# Default source: ~/Projects/workspace/relaybase/icon.png
# (falls back to desktop/app-icon.png if the workspace file is missing)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEFAULT_SRC="${HOME}/Projects/workspace/relaybase/icon.png"
FALLBACK_SRC="$ROOT/desktop/app-icon.png"
SRC="${1:-}"

if [[ -z "$SRC" ]]; then
  if [[ -f "$DEFAULT_SRC" ]]; then
    SRC="$DEFAULT_SRC"
  else
    SRC="$FALLBACK_SRC"
  fi
fi

if [[ ! -f "$SRC" ]]; then
  echo "Source icon not found: $SRC" >&2
  exit 1
fi

if command -v magick >/dev/null 2>&1; then
  IM=(magick)
elif command -v convert >/dev/null 2>&1; then
  IM=(convert)
else
  echo "ImageMagick ('magick' or 'convert') is required." >&2
  exit 1
fi

echo "Source: $SRC"

# Canonical 1024 master used by Tauri + notifications.
MASTER="$ROOT/desktop/app-icon.png"
"${IM[@]}" "$SRC" -background none -gravity center -extent 1024x1024 \
  -strip PNG32:"$MASTER"
echo "  → desktop/app-icon.png (1024)"

# Tauri / macOS / Windows / iOS / Android launcher set
(
  cd "$ROOT/desktop"
  pnpm exec tauri icon "$MASTER"
)
echo "  → desktop/src-tauri/icons/* (tauri icon)"

# Website public assets
"${IM[@]}" "$MASTER" -resize 512x512 -strip PNG32:"$ROOT/hq/website/public/icon.png"
"${IM[@]}" "$MASTER" -resize 32x32 -strip PNG32:"$ROOT/hq/website/public/favicon.png"
"${IM[@]}" "$MASTER" -resize 180x180 -strip PNG32:"$ROOT/hq/website/public/apple-touch-icon.png"
echo "  → hq/website/public/{icon,favicon,apple-touch-icon}.png"

# Desktop Next app favicon / sidebar mark
"${IM[@]}" "$MASTER" -resize 256x256 -strip PNG32:"$ROOT/app/public/icon.png"
echo "  → app/public/icon.png (256)"

# Mobile (uses desktop icons + app public icon)
if [[ -x "$ROOT/mobile/scripts/sync-icons.sh" ]]; then
  "$ROOT/mobile/scripts/sync-icons.sh"
fi

echo "Done. Brand icons synced to website, app, Mac (Tauri), and mobile."
