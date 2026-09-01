# Relaybase desktop release guide

Signed, notarized **Universal** macOS release (Apple Silicon + Intel in one
`.app`). Binaries live on **Cloudflare R2** (`download.relaybase.xyz`); small
metadata lives on `relaybase.xyz/release`.

Desktop and Worker versions are **independent**. Both start at **0.1.0**. Later
updates bump the **patch** only (`0.1.1`, `0.1.2`, …). There is no separate
dev / `+local` channel.

Worker releases: [server/customer-install/RELEASE.md](../../server/customer-install/RELEASE.md).

Pattern mirrors sibling `../kloy/app/docs/release.md`.

---

## macOS target (Universal only)

`pnpm run build:macos` (and `pnpm run build` in `desktop/`) always builds a
fat binary. Host-arch-only and per-arch DMGs are not a release.

**Agents / operators:** for **shipping**, never use the local arm64 scripts below or bare
`tauri build` without `--target universal-apple-darwin`. On Apple Silicon that
produces **arm64-only** output under `target/release/bundle/` — it looks signed
but is not the shipped Universal DMG and may fail to open on Intel Macs. The
release script verifies `lipo -info` shows both `x86_64` and `arm64` before
sync/R2 upload.

```text
tauri build --target universal-apple-darwin --bundles app,dmg
```

- Rust targets (the script installs them): `aarch64-apple-darwin` and
  `x86_64-apple-darwin`.
- Bundle output:
  `desktop/src-tauri/target/universal-apple-darwin/release/bundle/{dmg,macos}/`
  — not `target/release/bundle`. Scripts honor `CARGO_TARGET_DIR` when set.
- Public names stay `Relaybase.<version>.dmg` and
  `Relaybase.<version>.app.tar.gz` (no arch suffix).
- `latest.json` writes the **same** URL + signature under `darwin-universal`,
  `darwin-aarch64`, and `darwin-x86_64` so Intel and Apple Silicon updaters
  both resolve.
- Size: frontend is stored once; only the Rust binary is duplicated. Expect
  roughly +6–7 MiB vs an Apple Silicon-only DMG.

Verify after build: `lipo -info` on `Relaybase.app/Contents/MacOS/Relaybase`
must list `x86_64` and `arm64`.

Do not overwrite an already-shipped version on R2. Versioned objects use
`Cache-Control: immutable` (1 year). Bump the patch and upload new keys.

---

## Local install test (Apple Silicon, **not** a release)

Fast **host-arch-only** builds for drag-to-`/Applications` smoke tests on your
own Mac. These are **not** Universal, **not** uploaded to R2, and **must not**
replace shipped release artifacts or `hq/website/public/release/latest.json`.

Scripts live in `desktop/package.json`; repo root wraps them with the
`desktop:` prefix.

| Goal | Repo root | `desktop/` |
|------|-----------|------------|
| Build arm64 release DMG + open | `pnpm run desktop:install:local` | `pnpm run install:local` |
| Build debug DMG + open | `pnpm run desktop:install:local:debug` | `pnpm run install:local:debug` |
| Build arm64 release DMG only | `pnpm run desktop:build:local` | `pnpm run build:local` |
| Build debug DMG only | `pnpm run desktop:build:local:debug` | `pnpm run build:local:debug` |
| Build `.app` only (fastest) | `pnpm run desktop:build:local:app` | `pnpm run build:local:app` |
| Open an existing local DMG / app | `desktop:open:local:dmg`, `desktop:open:local:debug:dmg`, `desktop:open:local:app` | same without prefix |

**Output paths** (do **not** confuse with the Universal release tree):

| Profile | `.app` / DMG |
|---------|----------------|
| Release (local) | `desktop/src-tauri/target/release/bundle/{macos,dmg}/` |
| Debug (local) | `desktop/src-tauri/target/debug/bundle/{macos,dmg}/` |
| **Shipped release** | `desktop/src-tauri/target/universal-apple-darwin/release/bundle/{macos,dmg}/` |

Under the hood, `build:local*` runs `tauri build` on the **host** triple (arm64 on
Apple Silicon). It skips dual-arch compile, `lipo`, `verify-universal-app.sh`,
notarization wrapper, `sync-release-artifacts.mjs`, and R2 upload.

**Agents:** use `desktop:install:local` (or `build:local*`) only when the user
asks for a **local install test** on Apple Silicon. For customer-facing release,
website sync, or updater metadata, use **`pnpm run build:macos`** only.

Daily UI work remains `pnpm dev` / `desktop:dev` (`tauri dev` → `target/debug/`).

---

## Build cautions

Read this before changing signing entitlements, running release builds from an
agent/automation, or debugging “The application Relaybase can't be opened.”

### Universal target only (arm64-only is not a release)

On Apple Silicon, `tauri build` without `--target universal-apple-darwin` writes
to `target/release/bundle/` and produces an **arm64-only** `.app` / DMG. The
`build:local*` / `install:local*` scripts intentionally use this path for **local
smoke tests only** — see [Local install test](#local-install-test-apple-silicon-not-a-release).
For anything that ships, always use `pnpm run build:macos`; the script fails if
`lipo -info` does not list both `x86_64` and `arm64`.

### Do **not** add `keychain-access-groups` to Developer ID entitlements

`desktop/src-tauri/entitlements.plist` must **not** include
`keychain-access-groups` for the public Developer ID DMG.

On **macOS 26 (Tahoe)** and recent releases, AMFI rejects the app at launch
(**error 163**, `Launchd job spawn failed`, generic Finder “can't be opened”)
even when `codesign --verify`, `spctl`, and notarization all pass. The
entitlement requires a matching **provisioning profile**, which Developer ID
distribution builds do not carry.

Owner/team secrets use the **login keychain** via `SecItem` in
`keyring_store.rs` instead. Do not reintroduce the data-protection keychain
entitlement to “fix” keychain prompts without testing a full signed release on
macOS 26.

Incident: **0.1.1** shipped with the entitlement and failed to launch on Tahoe;
**0.1.2** removed it.

### Codesign needs a real terminal + network

Release builds call Apple's timestamp server during `codesign`. Automated or
sandboxed runs can fail mid-bundle with:

```text
A timestamp was expected but was not found.
failed to bundle project: failed codesign application
```

Run from a normal shell on the release Mac:

```bash
cd desktop && RELAYBASE_NOTARIZE=1 pnpm run build:macos
```

Do not treat a failed codesign bundle as shippable.

### Install and smoke-test from the DMG

For local verification, open the **notarized DMG** and drag `Relaybase.app` to
`/Applications`. Avoid testing copies made with `ditto` / automation — they can
pick up `com.apple.macl` extended attributes and confuse Gatekeeper debugging.

Quick checks after install:

```bash
lipo -info /Applications/Relaybase.app/Contents/MacOS/Relaybase   # x86_64 arm64
codesign --verify --deep --strict /Applications/Relaybase.app
spctl -a -vv /Applications/Relaybase.app                          # Notarized Developer ID
codesign -d --entitlements - --xml /Applications/Relaybase.app/Contents/MacOS/Relaybase \
  | rg keychain-access-groups                                     # must be empty
open -a Relaybase
```

### R2 upload account

`upload-release-r2.sh` uses the **website** Cloudflare account from
`hq/website/wrangler.jsonc` (or `RELAYBASE_RELEASE_CF_ACCOUNT_ID`). A wrong
`CLOUDFLARE_ACCOUNT_ID` in `desktop/.env` uploads to a different account and
returns 403 or invisible objects.

### Website release metadata path

Sync/upload scripts resolve `hq/website/public/release/` as **`desktop/../hq`**
(repo root). Using `desktop/../../hq` writes to a sibling `productions/hq/` tree
outside the repo — R2 upload still works but git never sees updated
`latest.json`.

After every release build, confirm:

```bash
git diff hq/website/public/release/latest.json   # version should match tauri.conf.json
```

---

## Architecture

```text
pnpm run build:macos
  ├─ rustup target add aarch64-apple-darwin x86_64-apple-darwin
  ├─ tauri build --target universal-apple-darwin --bundles app,dmg
  ├─ sync-release-artifacts.mjs  → hq/website/public/release/ (desktop/../hq)
  └─ upload-release-r2.sh        → R2 bucket relaybase-releases
```

| Artifact | Where | Public URL |
|----------|-------|------------|
| `latest.json` | git → website assets | `https://relaybase.xyz/release/latest.json` |
| `Relaybase.<version>.dmg` | R2 `relaybase-releases` | `https://download.relaybase.xyz/Relaybase.<version>.dmg` |
| `Relaybase.<version>.app.tar.gz` | R2 | `https://download.relaybase.xyz/Relaybase.<version>.app.tar.gz` |

---

## Git workflow

Every desktop release uses a dedicated branch. Do **not** bump versions or
commit release metadata straight on `main`.

```text
release-<semver>    # e.g. release-0.1.1
```

1. `git checkout main && git pull`
2. `git checkout -b release-X.Y.Z`
3. All release work on that branch
4. Push branch, tag `vX.Y.Z`
5. Merge into `main`, push `main` + tag
6. Deploy `hq/website` so `latest.json` is live
7. Keep `release-X.Y.Z` on the remote

---

## Checklist

### 1. Version bump

Set the **same** patch version in:

- `desktop/package.json`
- `desktop/src-tauri/Cargo.toml` (refresh `Cargo.lock` via build)
- `desktop/src-tauri/tauri.conf.json`

### 2. Release notes (required)

Create `desktop/public/release-notes/X.Y.Z.md`:

```markdown
---
date: YYYY-MM-DD
---

# Relaybase X.Y.Z

## Highlights
- …

## Changes
- …
```

`sync-release-artifacts.mjs` **fails** if this file is missing.

### 3. Build + notarize + R2

Credentials in `desktop/.env` (gitignored) + `scripts/deploy/apple-signing.env`:

| Variable | Purpose |
|----------|---------|
| `TAURI_SIGNING_PRIVATE_KEY_PATH` | Updater minisign key |
| `APPLE_SIGNING_IDENTITY` / `APPLE_TEAM_ID` | Developer ID |
| `APPLE_API_ISSUER` / `APPLE_API_KEY` / `APPLE_API_KEY_PATH` | Notarization |
| `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` | R2 upload |

```bash
cd desktop
pnpm run build:macos
```

R2 (already provisioned): bucket `relaybase-releases`, CDN `download.relaybase.xyz`.
The custom domain must use zone `relaybase.xyz` on the Strum account
(`1474b7eaef3a2527c2bdc83d666143f5`). A stale/wrong zone ID produces
Cloudflare 522 even though R2 lists the domain as connected.

```bash
cd hq/website
pnpm dlx wrangler@4 r2 bucket domain add relaybase-releases \
  --domain download.relaybase.xyz \
  --zone-id 1474b7eaef3a2527c2bdc83d666143f5 \
  --min-tls 1.2 --force
```

Manual R2 upload:

```bash
bash scripts/deploy/upload-release-r2.sh
```

### 4. Commit what belongs in git

**Do commit:** version bumps, release notes, `hq/website/public/release/latest.json`, `artifacts.json`, `.sig`.

**Do not commit:** `Relaybase.*.dmg`, `Relaybase.*.app.tar.gz`, `desktop/.env`, `updater.key`.

### 5. Deploy the website

```bash
cd hq/website
pnpm run deploy:cf
```

This ships `latest.json` / marketing. DMG and updater `.tar.gz` are already live
on `download.relaybase.xyz` after the R2 upload.

### 6. Verify

```bash
curl -sI https://relaybase.xyz/release/latest.json | grep -i content-type
# expect: application/json
curl -s https://relaybase.xyz/release/latest.json | head -c 200; echo
```

Test in-app updates only with a **release** build, not `tauri dev`.

---

## Versioning

- Patch only after 0.1.0 (`0.1.1`, `0.1.2`, …).
- Desktop and Worker do **not** have to ship together.
- Do not reuse an older `release-*` branch for a new version.
