# Relaybase mobile

iOS-first Flutter email companion for a customer-deployed Relaybase Worker.

The app exposes **only** the Relaybase email mode (Inbox, Sent, Drafts, Trash,
Compose) with a Gmail-like list → thread → compose flow. It connects **directly**
to the Worker `/mobile/*` routes using a **per-account** mobile password
provisioned from the desktop app.

**Policy (source of truth):** [docs/features/mobile-companion.md](../docs/features/mobile-companion.md)

## Sign-in

1. On **desktop**, open **Accounts** → the address → **Other device**.
2. Enable mobile for that address, then **Generate** (or regenerate) the password.
3. Copy the password (12 characters). Optionally scan the pairing QR.
4. On the phone, enter **account email + password**. The Worker URL is baked into
   the build (`AppConfig.defaultWorkerUrl`) — users never type it.

QR / `relaybase://connect?…` is optional convenience only. Login must work with
email + password alone.

Each teammate gets **one** address. The Worker scopes every `/mobile/*` call to
that authenticated email — there is no “All inboxes” on mobile.

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
  Android, so an optional Other device QR deep link can open this app.

From the repo root you can also run `pnpm mobile:setup` to scaffold + fetch
deps in one step.

## Run

```bash
flutter run -d ios        # iOS (primary target)
flutter run -d android   # Android (follow-up release)
```

**iOS Simulator note:** `mobile_scanner` (ML Kit) needs an x86_64 / Rosetta-capable
simulator image (e.g. iPhone 16 Pro on iOS 18). Newer arm64-only sims may fail
to build/link the scanner plugin; use a supported sim or run on device.

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
- **flutter_secure_storage** for account email + mobile password
  (`lib/services/secure_storage_service.dart`).
- **http** for `/mobile/*` calls (`lib/services/mobile_api_service.dart`).
- **Cupertino-first** theming branded to match the desktop app (`#e85d2a`
  primary, sharp `rounded-lg` controls). Drawer / FAB / swipe keep the mail
  shell layout.

Icons are synced from `desktop/src-tauri/icons` (+ `app/public/icon.png` for
in-app use) via `./scripts/sync-icons.sh` (also run by `setup.sh`).
