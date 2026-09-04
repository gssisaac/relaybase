# Product version sync (Desktop + Worker)

**Audience:** humans and coding agents cutting a Relaybase release.

Relaybase has two customer-facing version numbers that **must always match**:

| Component | Where the version lives |
|-----------|-------------------------|
| **Desktop** (macOS app + in-app updater) | `desktop/package.json`, `desktop/src-tauri/Cargo.toml`, `desktop/src-tauri/tauri.conf.json` |
| **Worker** (hosted install ZIP + `/health`) | sibling `../relaybase-worker/package.json`, dogfood `../relaybase-worker/wrangler.local.toml` `[vars] WORKER_VERSION`, packed `wrangler.toml` inside the install ZIP |

**First public release: `0.1.1`.** Subsequent releases bump the patch (`0.1.2`, `0.1.3`, …).

## Policy

1. **One semver for both** — e.g. Desktop `0.1.1` + Worker `0.1.1`. Never ship mismatched patch labels.
2. **Bump together** — every release touches Desktop **and** Worker, even when only one side changed materially (users compare Settings → Worker version against the app version).
3. **Release notes in pairs** — `desktop/public/release-notes/X.Y.Z.md` and `../relaybase-worker/release-notes/X.Y.Z.md` with the **same version** and aligned Highlights (wording may differ per surface). The marketing site `/release-notes` page is built from the **desktop** files (synced into `hq/website/content/release-notes` on `pnpm run dev` / `build`).
4. **Patch-only channel** — use `0.1.2`, `0.1.3`, … No separate dev / `+local` product channel.
5. **HQ / app packages** (`hq/website`, `app/`, repo root) are **not** product version — leave them on their own package versions unless explicitly bumped for unrelated deploys.

## Desktop-only material changes

When only the macOS app changed (no Worker script diff), you may **skip** republishing the Worker install ZIP **only if** the running Worker version label stays on the previous patch (e.g. desktop `0.1.2`, Worker still `0.1.1`). Users will not see a Worker update prompt until both sides share the same patch again.

That is **not** a metadata-only desktop release:

- Still run a **full** `RELAYBASE_NOTARIZE=1 pnpm run build:macos` in the same session as the version bump.
- Still upload the **new** DMG and updater `.tar.gz` built from that run.
- **Never** rename, copy, or re-upload an older DMG/tar.gz under a new version filename to “bust CDN cache” or avoid a rebuild.
- `verify-release-bundle.mjs` (wired into build, sync, and R2 upload) refuses when `CFBundleShortVersionString` ≠ `tauri.conf.json` or required embedded routes are missing.

## Release checklist (both sides)

1. Pick the next patch (both packages get the same string).
2. Write **both** release-note files (pack script **fails** without Worker notes).
3. Bump Desktop: `package.json`, `Cargo.toml`, `tauri.conf.json`.
4. Bump Worker: `../relaybase-worker/package.json`, `../relaybase-worker/wrangler.toml` (and `wrangler.local.toml` if present) `WORKER_VERSION`.
5. `cd ../relaybase-worker && pnpm run publish:github` (versioned `worker.X.Y.Z.js` + ZIP on GitHub Releases).
6. Desktop signed build → `sync-release-artifacts` → commit `hq/website/public/release/latest.json` + `artifacts.json`.
7. Deploy `hq/website`.

Detailed steps: [desktop/docs/release.md](../../desktop/docs/release.md), [`../relaybase-worker/docs/RELEASE.md`](../../relaybase-worker/docs/RELEASE.md).

## Verify

```bash
# Same version string everywhere that matters
node -p "require('./desktop/package.json').version"
node -p "require('../relaybase-worker/package.json').version"
rg 'WORKER_VERSION' ../relaybase-worker/wrangler.toml

# Hosted manifests (after pack / desktop sync)
curl -sL https://github.com/strum-us/relaybase-worker/releases/latest/download/worker-install-manifest.json | jq .version
curl -s https://relaybase.xyz/release/latest.json | jq .version
```

# Deployed Worker: `GET /health` → `version` should match the install manifest.

# After desktop build / R2 upload (on macOS):
node desktop/scripts/deploy/verify-release-bundle.mjs \
  --tgz desktop/src-tauri/target/aarch64-apple-darwin/release/bundle/macos/Relaybase.app.tar.gz
