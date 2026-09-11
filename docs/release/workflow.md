# Release workflow (Desktop + Worker)

**Audience:** humans and coding agents shipping a Relaybase patch release.

This is the end-to-end checklist. Deep dives:

| Topic | Doc |
|-------|-----|
| Version pairing policy | [version-sync.md](version-sync.md) |
| macOS build, notarize, R2, updater | [desktop/docs/release.md](../../desktop/docs/release.md) |
| Worker pack + GitHub publish | [../worker/docs/RELEASE.md](../../../worker/docs/RELEASE.md) (sibling `worker/` repo) |

---

## Overview

Two repos, two release branches, three publish surfaces:

| Surface | What ships | Where customers get it |
|---------|------------|------------------------|
| **Desktop** | Signed notarized DMG + updater `.tar.gz` | Cloudflare R2 (`download.relaybase.xyz`) |
| **Desktop metadata** | `latest.json`, `artifacts.json`, `.sig` | Git → `hq/website` deploy → `relaybase.xyz/release/` |
| **Worker** | `worker.X.Y.Z.js` + install ZIP + manifest | GitHub Releases (`strum-us/relaybase-worker`) |

The Mac app checks **GitHub** for Worker updates and **relaybase.xyz/release/latest.json** for desktop updates.

**Critical:** `pnpm run pack:customer-install` (or `build:bundle`) alone does **not** update customers. You must run **`pnpm run publish:github`** in `worker/` or Settings → Worker version will keep showing the previous release as “up to date.”

---

## Branches

Never bump versions or commit release metadata directly on `main`.

| Repo | Branch pattern | Example |
|------|----------------|---------|
| `main/` | `release-X.Y.Z` | `release-0.1.6` |
| `worker/` | `release-worker-X.Y.Z` | `release-worker-0.1.3` |

Typical start (from each repo):

```bash
git checkout main && git pull
git checkout -b release-X.Y.Z    # or release-worker-X.Y.Z in worker/
```

Finish with PR → merge → keep the release branch on the remote.

---

## Step-by-step checklist

### 1. Pick versions

- **Desktop:** next patch in `desktop/package.json` (e.g. `0.1.5` → `0.1.6`).
- **Worker:** next patch in `worker/package.json` + `wrangler.toml` `WORKER_VERSION` when Worker code changed.
- Desktop-only releases may skip Worker republish (Worker label stays on the previous patch). When Worker code changed, bump Worker and note the pairing in desktop release notes (`Pairs with Worker install bundle **X.Y.Z**.`). See [version-sync.md](version-sync.md).

### 2. Release notes (required)

| Repo | Path |
|------|------|
| Desktop | `main/desktop/public/release-notes/X.Y.Z.md` |
| Worker | `worker/release-notes/X.Y.Z.md` |

Both pack scripts **fail** if notes are missing. Website `/release-notes` syncs from the **desktop** files at build time.

### 3. Bump version strings

**Desktop** (same string in all three):

- `desktop/package.json`
- `desktop/src-tauri/Cargo.toml`
- `desktop/src-tauri/tauri.conf.json`

**Worker** (when shipping Worker changes):

- `worker/package.json`
- `worker/wrangler.toml` → `WORKER_VERSION`
- `worker/wrangler.toml` → `DESKTOP_VERSION` (desktop app version this Worker build is compatible with; reported in `/health` as `desktopVersion` and read back by `pack-customer-install.mjs` into the packed install ZIP)

### 4. Build desktop (macOS release Mac, normal terminal + network)

```bash
cd main/desktop
RELAYBASE_NOTARIZE=1 pnpm run build:macos
```

This runs: Tauri aarch64 build → verify bundle → sync `hq/website/public/release/latest.json` + `.sig` → R2 upload (if credentials present).

If R2 upload fails mid-pipeline, re-run only upload after the bundle exists:

```bash
cd main/desktop
RELAYBASE_MAC_ARCH=aarch64 bash scripts/deploy/upload-release-r2.sh
```

Requires `CLOUDFLARE_API_TOKEN` + account from `hq/website/wrangler.jsonc` (`RELAYBASE_RELEASE_CF_ACCOUNT_ID`).

**Never** metadata-only desktop releases. **Never** overwrite existing `Relaybase.X.Y.Z.*` keys on R2 (immutable CDN cache — bump patch instead).

### 5. Pack + publish Worker (when Worker changed)

```bash
cd worker
pnpm run publish:github
```

This runs `pack:customer-install` then creates/updates GitHub Release `vX.Y.Z` with:

- `worker.X.Y.Z.js`
- `relaybase-worker-install-X.Y.Z.zip` (+ `relaybase-worker-install.zip` alias)
- `worker-install-manifest.json`

Requires `gh` auth. **Do not skip this step** — the desktop app reads `releases/latest/download/worker-install-manifest.json`.

### 6. Deploy website

Ships `latest.json`, release notes, and download Worker routes:

```bash
cd main/hq/website
pnpm run deploy:cf
```

Set `CLOUDFLARE_API_TOKEN` (website account). Large DMG/tar.gz binaries are already on R2 after step 4.

### 7. Commit on release branches

**Commit to git (main repo):**

- Version bumps
- Release notes
- `hq/website/public/release/latest.json`, `artifacts.json`, `*.sig`

**Do not commit:** DMG, `.app.tar.gz`, `desktop/.env`, signing keys, `worker/dist/`.

**Commit to git (worker repo):**

- Version bumps
- Release notes
- README download links (optional)

### 8. Push, PR, merge

```bash
# main
git push -u origin release-X.Y.Z
gh pr create --base main --head release-X.Y.Z --title "Release desktop X.Y.Z" --body "..."

# worker
git push -u origin release-worker-X.Y.Z
gh pr create --base main --head release-worker-X.Y.Z --title "Release worker X.Y.Z" --body "..."
```

After merge: tag desktop repo `vX.Y.Z` if you tag desktop releases; Worker tag is created by `publish:github`.

---

## Verify

```bash
# Desktop updater manifest
curl -s https://relaybase.xyz/release/latest.json | jq .version

# Worker install manifest (must match published GitHub release, not local dist/)
curl -sL https://github.com/strum-us/relaybase-worker/releases/latest/download/worker-install-manifest.json | jq .version

# R2 DMG
curl -sI https://download.relaybase.xyz/Relaybase.X.Y.Z.aarch64.dmg | grep -iE 'HTTP|content-type'

# Deployed Worker (after user updates in app)
curl -s https://YOUR-WORKER.workers.dev/health | jq .version
```

In the Mac app: **Settings → Worker version → Check for updates**. An update appears only when:

1. GitHub manifest version **>** installed Worker version, and
2. Manifest version **≤** installed desktop app version.

Users must click **Update Worker** to redeploy — publishing to GitHub does not auto-deploy to their Cloudflare account.

---

## Common mistakes

| Mistake | Symptom | Fix |
|---------|---------|-----|
| Packed Worker but skipped `publish:github` | App says Worker is “up to date” on old version | Run `pnpm run publish:github` |
| Bumped `latest.json` without rebuilding DMG | Updater downloads wrong/old binary | Full `build:macos` in same session as version bump |
| Re-uploaded same R2 key for a version | Some users stuck on old build forever | Bump patch; never overwrite immutable keys |
| Worker manifest **>** desktop version | No Worker update offered | Publish Worker ≤ desktop, or ship desktop first |
| R2 upload with wrong `CLOUDFLARE_ACCOUNT_ID` | 401 / invisible objects | Use website account from `hq/website/wrangler.jsonc` |

---

## Local smoke tests (not releases)

| Goal | Command |
|------|---------|
| Local DMG install test | `cd main && pnpm run desktop:install:local` |
| Worker bundle only (dogfood) | `cd worker && pnpm run build:bundle` |
| Pack without GitHub | `cd worker && pnpm run pack:customer-install` |
