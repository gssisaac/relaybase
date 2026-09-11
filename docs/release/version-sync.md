# Product version sync (Desktop + Worker)

**Audience:** humans and coding agents cutting a Relaybase release.

See the full checklist: **[workflow.md](workflow.md)**.

---

## Where versions live

| Component | Where the version lives |
|-----------|-------------------------|
| **Desktop** (macOS app + in-app updater) | `desktop/package.json`, `desktop/src-tauri/Cargo.toml`, `desktop/src-tauri/tauri.conf.json` |
| **Worker** (hosted install ZIP + `/health`) | sibling `worker/package.json`, `worker/wrangler.toml` `[vars] WORKER_VERSION`, `worker/wrangler.toml` `[vars] DESKTOP_VERSION` (packed `wrangler.toml` inside the install ZIP mirrors both) |

**First public release: `0.1.1`.** Subsequent releases bump the patch (`0.1.2`, `0.1.3`, …). No separate dev / `+local` channel.

---

## Policy

1. **Aligned product story** — Desktop release notes state which Worker bundle they pair with (`Pairs with Worker install bundle **X.Y.Z**.`). Users compare Settings → Worker version against the desktop app.
2. **Bump Worker when Worker code ships** — any release that changes `worker/src/` must bump Worker version, write Worker release notes, and run **`pnpm run publish:github`** (pack alone is not enough).
3. **Desktop-only releases** — when only the macOS app changed, you may skip republishing the Worker install ZIP. The Worker version label can stay on the previous patch (e.g. desktop `0.1.5`, Worker still `0.1.2`). Users will not see a Worker update prompt until a new Worker release is published and is ≤ desktop version.
4. **Release notes** — `desktop/public/release-notes/X.Y.Z.md` and `worker/release-notes/X.Y.Z.md` when Worker ships. Website `/release-notes` syncs from **desktop** files.
5. **HQ / app packages** (`hq/website`, `app/`, repo root) are **not** product version.

---

## Desktop update rules (in-app)

The Mac app offers a Worker update only when:

- Installed Worker version **<** desktop app version, **and**
- GitHub manifest version **≤** desktop app version, **and**
- Manifest version **>** installed Worker version.

So the Worker GitHub release must be published before “Check for updates” shows anything new.

---

## Desktop-only material changes

When only the macOS app changed (no Worker script diff):

- Still run a **full** `RELAYBASE_NOTARIZE=1 pnpm run build:macos` in the same session as the version bump.
- Still upload the **new** DMG and updater `.tar.gz` built from that run.
- **Never** rename, copy, or re-upload an older DMG/tar.gz under a new version filename.
- `verify-release-bundle.mjs` (wired into build, sync, and R2 upload) refuses when `CFBundleShortVersionString` ≠ `tauri.conf.json` or required embedded routes are missing.

---

## Quick verify

```bash
node -p "require('./desktop/package.json').version"
node -p "require('../worker/package.json').version"
rg 'WORKER_VERSION|DESKTOP_VERSION' ../worker/wrangler.toml

curl -sL https://github.com/strum-us/relaybase-worker/releases/latest/download/worker-install-manifest.json | jq .version
curl -s https://relaybase.xyz/release/latest.json | jq .version
```

Deployed Worker: `GET /health` → `version` should match what the user deployed (not necessarily the desktop patch label when desktop-only releases skipped Worker). `GET /health` → `desktopVersion` is the desktop app ceiling this Worker build advertises to mailbox-mode (invited/team) desktop sessions; it gates team-member desktop auto-updates so they never self-update past what the connected Worker supports. Bump `DESKTOP_VERSION` in `worker/wrangler.toml` whenever a Worker build is cut to pair with a new desktop release.
