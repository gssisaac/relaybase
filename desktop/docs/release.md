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

`pnpm run build:macos` always builds a fat binary. Host-arch-only and
per-arch DMGs are not a release.

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

## Architecture

```text
pnpm run build:macos
  ├─ rustup target add aarch64-apple-darwin x86_64-apple-darwin
  ├─ tauri build --target universal-apple-darwin --bundles app,dmg
  ├─ sync-release-artifacts.mjs  → hq/website/public/release/
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
