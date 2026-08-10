# Relaybase mobile

iOS-first Flutter email companion for a customer-deployed Relaybase Worker.

The app exposes **only** the Relaybase email mode (Inbox, Sent, Drafts, Trash,
Compose) with a Gmail-like list → thread → compose flow. It connects **directly**
to the customer Cloudflare Worker using a new `/mobile/*` route family
authenticated by a mobile access password the desktop app configures.

## Pairing

1. In the **desktop** app, open **Settings → Mobile access** and enable it.
   Copy the generated mobile password.
2. Open the dashboard **Accounts** sheet → **Other device** tab for the
   account you want on mobile, enable it, paste the password, and scan the QR
   with this app. The QR encodes `relaybase://connect?workerUrl=…&password=…`.
3. You can also enter the Worker URL + password manually on the Connect screen.

## Setup

Flutter is required (>= 3.22). The `ios/` and `android/` folders are generated
by the setup script:

```bash
cd mobile
./scripts/setup.sh
flutter pub get
```

`setup.sh` runs `flutter create . --platforms=ios,android --project-name=relaybase`
to scaffold the native projects, then:

- sets the bundle/application id to `com.relaybase.mobile` and the display name
  to `Relaybase`,
- registers the `relaybase://` URL scheme on iOS (`CFBundleURLTypes` in
  `ios/Runner/Info.plist`) and an `intent-filter` for `relaybase://connect` on
  Android, so the desktop Other device tab QR deep link opens this app.

From the repo root you can also run `pnpm mobile:setup` to scaffold + fetch
deps in one step.

## Run

```bash
flutter run -d ios        # iOS (primary target)
flutter run -d android   # Android (follow-up release)
```

## Build

```bash
flutter build ios --release
flutter build apk --release
```

Convenience scripts are wired into the repo root `package.json`:

- `pnpm mobile:ios` — `flutter run -d ios`
- `pnpm mobile:android` — `flutter run -d android`
- `pnpm mobile:build:ios` — `flutter build ios --release`
- `pnpm mobile:build:apk` — `flutter build apk --release`

## Architecture

- **Riverpod** for state (`lib/providers/`).
- **Hive** for offline cache (`lib/services/storage_service.dart`).
- **flutter_secure_storage** for the Worker URL + mobile password
  (`lib/services/secure_storage_service.dart`).
- **http** for `/mobile/*` calls (`lib/services/mobile_api_service.dart`).
- **Cupertino-first** theming with a Material/Cupertino hybrid for Gmail-like
  affordances (drawer, FAB, swipe actions).

See `/opt/cursor/artifacts/plans/flutter-mobile-email_1ec50219.plan.md` for
the full design.
