# Relaybase desktop release guide

Signed, notarized macOS release. Binaries live on **Cloudflare R2**
(`download.relaybase.xyz`); small metadata lives on `relaybase.xyz/release`.

Desktop and Worker versions are **independent**. Both start at **0.1.0**. Later
updates bump the **patch** only (`0.1.1`, `0.1.2`, …). There is no separate
dev / `+local` channel.

Worker releases: [server/customer-install/RELEASE.md](../../server/customer-install/RELEASE.md).

Pattern mirrors sibling `../kloy/app/docs/release.md`.

---

## Architecture

```text
pnpm run build:macos
  ├─ tauri build --bundles app,dmg  (sign + notarize)
  ├─ sync-release-artifacts.mjs  → kembo/website/public/release/
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
6. Deploy `kembo/website` so `latest.json` is live
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

Manual R2 upload:

```bash
bash scripts/deploy/upload-release-r2.sh
```

### 4. Commit what belongs in git

**Do commit:** version bumps, release notes, `kembo/website/public/release/latest.json`, `artifacts.json`, `.sig`.

**Do not commit:** `Relaybase.*.dmg`, `Relaybase.*.app.tar.gz`, `desktop/.env`, `updater.key`.

### 5. Deploy the website

```bash
cd kembo/website
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
