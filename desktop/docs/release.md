# Relaybase desktop release guide

Signed, notarized **per-arch** macOS releases. **Apple Silicon (`aarch64`) is
the shipped default.** Intel (`x86_64`) scripts and R2/updater wiring exist, but
the download page keeps Intel disabled until the first Intel build ships.

Binaries live on **Cloudflare R2** (`download.relaybase.xyz`); small metadata
lives on `relaybase.xyz/release`.

Desktop and Worker share **one product semver** — always bump both together.
First public release: **0.1.1**. Policy: [docs/release/version-sync.md](../../docs/release/version-sync.md).

**CRITICAL (Pre-launch):** Version is frozen at **`0.1.1`**. Do **NOT** bump versions before official launch. Later updates after launch bump the **patch** only (`0.1.2`, `0.1.3`, …). There is no separate
dev / `+local` channel.

Worker releases: [`relaybase-worker/docs/RELEASE.md`](../../../relaybase-worker/docs/RELEASE.md).

Pattern mirrors sibling `../kloy/app/docs/release.md`.

---

## macOS targets (per-arch; Universal retired)

`pnpm run build:macos` (and `pnpm run build` in `desktop/`) builds **Apple
Silicon only**:

```text
tauri build --target aarch64-apple-darwin --bundles app,dmg
```

Intel is a separate opt-in command (same signing / notarize / sync / R2 path):

```text
pnpm run build:macos:x86_64
# → tauri build --target x86_64-apple-darwin --bundles app,dmg
```

| Arch | Command | Rust target | Bundle output | Public names |
|------|---------|-------------|---------------|--------------|
| Apple Silicon (ship) | `build:macos` / `build:macos:aarch64` | `aarch64-apple-darwin` | `…/target/aarch64-apple-darwin/release/bundle/` | `Relaybase.<ver>.aarch64.dmg` · `.app.tar.gz` |
| Intel (ready, not default) | `build:macos:x86_64` | `x86_64-apple-darwin` | `…/target/x86_64-apple-darwin/release/bundle/` | `Relaybase.<ver>.x86_64.dmg` · `.app.tar.gz` |

`latest.json` platforms:

- `darwin-aarch64` — written by the aarch64 build
- `darwin-x86_64` — written by the x86_64 build (merged if same version)
- `darwin-universal` — **retired**; sync strips it on new writes

Do not overwrite an already-shipped version+arch on R2. Versioned objects use
`Cache-Control: immutable` (1 year). Bump the patch and upload new keys.

Verify after build: `lipo -info` on `Relaybase.app/Contents/MacOS/Relaybase`
must list **only** the expected arch (`arm64` or `x86_64`), never both.

---

## Local install test (Apple Silicon, **not** a release)

Fast **host-arch** builds for drag-to-`/Applications` smoke tests on your own
Mac. These skip notarization, sync, and R2, and **must not** replace shipped
release artifacts or `hq/website/public/release/latest.json`.

| Goal | Repo root | `desktop/` |
|------|-----------|------------|
| Build arm64 release DMG + open | `pnpm run desktop:install:local` | `pnpm run install:local` |
| Build debug DMG + open | `pnpm run desktop:install:local:debug` | `pnpm run install:local:debug` |
| Build arm64 release DMG only | `pnpm run desktop:build:local` | `pnpm run build:local` |
| Build debug DMG only | `pnpm run desktop:build:local:debug` | `pnpm run build:local:debug` |
| Build `.app` only (fastest) | `pnpm run desktop:build:local:app` | `pnpm run build:local:app` |
| Open an existing local DMG / app | `desktop:open:local:*` | same without prefix |

**Output paths:**

| Profile | `.app` / DMG |
|---------|----------------|
| Local smoke (`build:local*`) | `desktop/src-tauri/target/release/bundle/` (or `debug/`) |
| **Shipped aarch64** | `desktop/src-tauri/target/aarch64-apple-darwin/release/bundle/` |
| **Shipped x86_64** | `desktop/src-tauri/target/x86_64-apple-darwin/release/bundle/` |

Daily UI work remains `pnpm dev` / `desktop:dev` (`tauri dev` → `target/debug/`).

---

## Build cautions

### Per-arch only (Universal is not a release)

`universal-apple-darwin` is rejected by `build-macos.sh`. Do not reintroduce fat
binaries — they double compile time on Apple Silicon and are not needed while
Intel is still gated on the download page.

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

Incident: pre-launch dogfood used mismatched Worker/Desktop versions and a multi-step D1 migration chain — retired before **0.1.1** (see [docs/release/version-sync.md](../../docs/release/version-sync.md)).

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
lipo -info /Applications/Relaybase.app/Contents/MacOS/Relaybase   # arm64 only for aarch64 ship
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
pnpm run build:macos                 # aarch64 (default ship)
  ├─ rustup target add aarch64-apple-darwin
  ├─ tauri build --target aarch64-apple-darwin --bundles app,dmg
  ├─ verify-arch-app.sh (arm64 only)
  ├─ sync-release-artifacts.mjs      → hq/website/public/release/ (*.aarch64.*)
  └─ upload-release-r2.sh            → R2 bucket relaybase-releases

pnpm run build:macos:x86_64          # Intel when ready
  └─ same pipeline with x86_64 names / darwin-x86_64 updater key
```

| Artifact | Where | Public URL |
|----------|-------|------------|
| `latest.json` | git → website assets | `https://relaybase.xyz/release/latest.json` |
| `Relaybase.<ver>.aarch64.dmg` | R2 | `https://download.relaybase.xyz/Relaybase.<ver>.aarch64.dmg` |
| `Relaybase.<ver>.aarch64.app.tar.gz` | R2 | updater for `darwin-aarch64` |
| `Relaybase.<ver>.x86_64.dmg` | R2 (when built) | download page `/file/x86_64` |
| `Relaybase.<ver>.x86_64.app.tar.gz` | R2 (when built) | updater for `darwin-x86_64` |

Beta download page (`/downloads/{uuid}`):

- Apple Silicon button → `/downloads/{uuid}/file/aarch64` (active)
- Intel button → disabled until `INTEL_MAC_DOWNLOAD_ENABLED` in
  `hq/website/src/worker/release.ts` is flipped **and** an x86_64 DMG is in
  `artifacts.json`
- `/downloads/{uuid}/file` (no arch) still redirects to Apple Silicon

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

`sync-release-artifacts.mjs` **fails** if this file is missing. The marketing
site `/release-notes` page syncs these files into `hq/website/content/release-notes`
on `pnpm run dev` / `build` — do not edit the website copies by hand.

### 3. Build + notarize + R2

Credentials in `desktop/.env` (gitignored) + `scripts/deploy/apple-signing.env`:

| Variable | Purpose |
|----------|---------|
| `TAURI_SIGNING_PRIVATE_KEY_PATH` | Updater minisign key |
| `APPLE_SIGNING_IDENTITY` / `APPLE_TEAM_ID` | Developer ID |
| `APPLE_API_ISSUER` / `APPLE_API_KEY` / `APPLE_API_KEY_PATH` | Notarization |
| `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` | R2 upload |

Apple Silicon (default ship):

```bash
cd desktop
RELAYBASE_NOTARIZE=1 pnpm run build:macos
```

Intel (when enabling that channel):

```bash
cd desktop
RELAYBASE_NOTARIZE=1 pnpm run build:macos:x86_64
# then flip INTEL_MAC_DOWNLOAD_ENABLED in hq/website/src/worker/release.ts
# and deploy hq/website
```

R2 (already provisioned): bucket `relaybase-releases`, CDN `download.relaybase.xyz`.

Manual R2 upload for one arch:

```bash
RELAYBASE_MAC_ARCH=aarch64 bash scripts/deploy/upload-release-r2.sh
RELAYBASE_MAC_ARCH=x86_64 bash scripts/deploy/upload-release-r2.sh
```

### 4. Commit what belongs in git

**Do commit:** version bumps, release notes, `hq/website/public/release/latest.json`, `artifacts.json`, `.sig`.

**Do not commit:** `Relaybase.*.dmg`, `Relaybase.*.app.tar.gz`, `desktop/.env`, `updater.key`.

### 5. Deploy the website

```bash
cd hq/website
pnpm run deploy:cf
```

This ships `latest.json` / marketing / download Worker. DMG and updater `.tar.gz`
are already live on `download.relaybase.xyz` after the R2 upload.

### 6. Verify

```bash
curl -sI https://relaybase.xyz/release/latest.json | grep -i content-type
# expect: application/json
curl -s https://relaybase.xyz/release/latest.json | head -c 400; echo
```

Test in-app updates only with a **release** build, not `tauri dev`. The
installed app checks `latest.json` ~8s after launch (then every 24h),
downloads in the background, and shows **Restart to update** in the sidebar.

---

## Versioning

- Patch only after **0.1.1** (`0.1.2`, `0.1.3`, …). Desktop and Worker semver must match — [docs/release/version-sync.md](../../docs/release/version-sync.md).
- Desktop and Worker do **not** have to ship together.
- Do not reuse an older `release-*` branch for a new version.
