#!/usr/bin/env bash
# Copy Relaybase app icons from desktop/src-tauri (same source as the Mac app)
# into the Flutter iOS/Android projects + in-app assets.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MOBILE="$ROOT/mobile"
SRC_ICONS="$ROOT/desktop/src-tauri/icons"
SRC_APP_ICON="$ROOT/app/public/icon.png"

if [[ ! -d "$SRC_ICONS/ios" ]]; then
  echo "Missing desktop icons at $SRC_ICONS/ios" >&2
  exit 1
fi

IOS_DEST="$MOBILE/ios/Runner/Assets.xcassets/AppIcon.appiconset"
ANDROID_RES="$MOBILE/android/app/src/main/res"
ASSETS_IMG="$MOBILE/assets/images"

mkdir -p "$IOS_DEST" "$ASSETS_IMG"

copy_ios() {
  local src="$1"
  local dest="$2"
  if [[ -f "$SRC_ICONS/ios/$src" ]]; then
    cp "$SRC_ICONS/ios/$src" "$IOS_DEST/$dest"
  else
    echo "warn: missing $src" >&2
  fi
}

# Flutter AppIcon.appiconset filenames ← Tauri ios/ set
copy_ios "AppIcon-20x20@1x.png" "Icon-App-20x20@1x.png"
copy_ios "AppIcon-20x20@2x.png" "Icon-App-20x20@2x.png"
copy_ios "AppIcon-20x20@3x.png" "Icon-App-20x20@3x.png"
copy_ios "AppIcon-29x29@1x.png" "Icon-App-29x29@1x.png"
copy_ios "AppIcon-29x29@2x.png" "Icon-App-29x29@2x.png"
copy_ios "AppIcon-29x29@3x.png" "Icon-App-29x29@3x.png"
copy_ios "AppIcon-40x40@1x.png" "Icon-App-40x40@1x.png"
copy_ios "AppIcon-40x40@2x.png" "Icon-App-40x40@2x.png"
copy_ios "AppIcon-40x40@3x.png" "Icon-App-40x40@3x.png"
copy_ios "AppIcon-60x60@2x.png" "Icon-App-60x60@2x.png"
copy_ios "AppIcon-60x60@3x.png" "Icon-App-60x60@3x.png"
copy_ios "AppIcon-76x76@1x.png" "Icon-App-76x76@1x.png"
copy_ios "AppIcon-76x76@2x.png" "Icon-App-76x76@2x.png"
copy_ios "AppIcon-83.5x83.5@2x.png" "Icon-App-83.5x83.5@2x.png"
copy_ios "AppIcon-512@2x.png" "Icon-App-1024x1024@1x.png"

# Android mipmaps + adaptive icon (same assets as desktop Tauri)
if [[ -d "$SRC_ICONS/android" ]]; then
  for density in mdpi hdpi xhdpi xxhdpi xxxhdpi; do
    mkdir -p "$ANDROID_RES/mipmap-$density"
    for f in ic_launcher.png ic_launcher_round.png ic_launcher_foreground.png; do
      if [[ -f "$SRC_ICONS/android/mipmap-$density/$f" ]]; then
        cp "$SRC_ICONS/android/mipmap-$density/$f" "$ANDROID_RES/mipmap-$density/$f"
      fi
    done
  done
  mkdir -p "$ANDROID_RES/mipmap-anydpi-v26" "$ANDROID_RES/values"
  if [[ -f "$SRC_ICONS/android/mipmap-anydpi-v26/ic_launcher.xml" ]]; then
    cp "$SRC_ICONS/android/mipmap-anydpi-v26/ic_launcher.xml" \
      "$ANDROID_RES/mipmap-anydpi-v26/ic_launcher.xml"
  fi
  if [[ -f "$SRC_ICONS/android/values/ic_launcher_background.xml" ]]; then
    cp "$SRC_ICONS/android/values/ic_launcher_background.xml" \
      "$ANDROID_RES/values/ic_launcher_background.xml"
  fi
fi

# In-app logo (connect screen, etc.)
if [[ -f "$SRC_APP_ICON" ]]; then
  cp "$SRC_APP_ICON" "$ASSETS_IMG/icon.png"
elif [[ -f "$SRC_ICONS/icon.png" ]]; then
  cp "$SRC_ICONS/icon.png" "$ASSETS_IMG/icon.png"
fi

# Prefer round launcher when available
if [[ -f "$ANDROID_RES/mipmap-xxxhdpi/ic_launcher_round.png" ]]; then
  # Keep @mipmap/ic_launcher pointing at adaptive / standard; round is optional.
  :
fi

echo "Synced Relaybase icons into mobile/ios, mobile/android, and assets/images/icon.png"
