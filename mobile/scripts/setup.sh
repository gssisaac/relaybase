#!/usr/bin/env bash
# Generate the native iOS/Android projects for the Relaybase mobile app.
# Run once after cloning (Flutter >= 3.22 required).
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v flutter >/dev/null 2>&1; then
  echo "flutter not found on PATH. Install Flutter >= 3.22 first." >&2
  exit 1
fi

# Scaffold native folders without overwriting lib/pubspec.
flutter create . \
  --platforms=ios,android \
  --project-name=relaybase \
  --org com.relaybase \
  --description "Relaybase mobile email companion"

# Display name + bundle id tweaks (idempotent).
if [[ -f ios/Runner.xcodeproj/project.pbxproj ]]; then
  sed -i.bak \
    -e 's/PRODUCT_BUNDLE_IDENTIFIER = [^;]*/PRODUCT_BUNDLE_IDENTIFIER = com.relaybase.mobile/g' \
    -e 's/CFBundleDisplayName = [^;]*/CFBundleDisplayName = Relaybase/g' \
    -e 's/CFBundleName = [^;]*/CFBundleName = Relaybase/g' \
    ios/Runner.xcodeproj/project.pbxproj
  rm -f ios/Runner.xcodeproj/project.pbxproj.bak
fi

if [[ -f android/app/build.gradle.kts ]]; then
  sed -i.bak \
    -e 's/applicationId = "[^"]*"/applicationId = "com.relaybase.mobile"/g' \
    android/app/build.gradle.kts
  rm -f android/app/build.gradle.kts.bak
fi

# Deep link pairing: register the relaybase:// URL scheme.
# iOS — inject CFBundleURLTypes into Runner/Info.plist if not present.
if [[ -f ios/Runner/Info.plist ]] && ! grep -q "relaybase" ios/Runner/Info.plist; then
  plutil -insert CFBundleURLTypes -xml '{
    "CFBundleTypeRole": "Editor",
    "CFBundleURLName": "com.relaybase.mobile",
    "CFBundleURLSchemes": ["relaybase"]
  }' ios/Runner/Info.plist 2>/dev/null || true
fi

# Android — add an intent-filter for relaybase://connect to the launcher activity.
_manifest="android/app/src/main/AndroidManifest.xml"
if [[ -f $_manifest ]] && ! grep -q "relaybase" $_manifest; then
  python3 - "$_manifest" <<'PY' || true
import re, sys
path = sys.argv[1]
with open(path, "r", encoding="utf-8") as f:
    manifest = f.read()
intent = """        <intent-filter android:autoVerify="true">
            <action android:name="android.intent.action.VIEW" />
            <category android:name="android.intent.category.DEFAULT" />
            <category android:name="android.intent.category.BROWSABLE" />
            <data android:scheme="relaybase" android:host="connect" />
        </intent-filter>"""
# Insert before the closing </activity> of the MAIN/LAUNCHER activity.
manifest = re.sub(
    r'(<intent-filter>[\s\S]*?LAUNCHER[\s\S]*?</intent-filter>)',
    r"\1\n" + intent,
    manifest,
    count=1,
)
with open(path, "w", encoding="utf-8") as f:
    f.write(manifest)
PY
fi

echo "Native projects ready. Run: flutter pub get && flutter run -d ios"
