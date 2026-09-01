# Product version sync (Desktop + Worker)

**Audience:** humans and coding agents cutting a Relaybase release.

Relaybase has two customer-facing version numbers that **must always match**:

| Component | Where the version lives |
|-----------|-------------------------|
| **Desktop** (macOS app + in-app updater) | `desktop/package.json`, `desktop/src-tauri/Cargo.toml`, `desktop/src-tauri/tauri.conf.json` |
| **Worker** (hosted install ZIP + `/health`) | `server/package.json`, dogfood `server/wrangler.toml` `[vars] WORKER_VERSION`, packed `wrangler.toml` inside the install ZIP |

**First public release: `0.1.1`.** Pre-launch dogfood versions (`0.1.0`–`0.1.3`) are retired — do not reference them in release notes or manifests.

## Policy

1. **One semver for both** — e.g. Desktop `0.1.2` + Worker `0.1.2`. Never ship mismatched patch labels.
2. **Bump together** — every release touches Desktop **and** Worker, even when only one side changed materially (users compare Settings → Worker version against the app version).
3. **Release notes in pairs** — `desktop/public/release-notes/X.Y.Z.md` and `server/release-notes/X.Y.Z.md` with the **same version** and aligned Highlights (wording may differ per surface).
4. **Patch-only channel** — after `0.1.1`, use `0.1.2`, `0.1.3`, … No separate dev / `+local` product channel.
5. **HQ / app packages** (`hq/website`, `app/`, repo root) are **not** product version — leave them on their own package versions unless explicitly bumped for unrelated deploys.

## Release checklist (both sides)

1. Pick the next patch (both packages get the same string).
2. Write **both** release-note files (pack script **fails** without Worker notes).
3. Bump Desktop: `package.json`, `Cargo.toml`, `tauri.conf.json`.
4. Bump Worker: `server/package.json`, `server/wrangler.toml` `WORKER_VERSION`.
5. `pnpm pack:worker-install` → commit `hq/website/public/downloads/*`.
6. Desktop signed build → `sync-release-artifacts` → commit `hq/website/public/release/latest.json` + `artifacts.json`.
7. Deploy `hq/website`.

Detailed steps: [desktop/docs/release.md](../desktop/docs/release.md), [server/customer-install/RELEASE.md](../server/customer-install/RELEASE.md).

## Verify

```bash
# Same version string everywhere that matters
node -p "require('./desktop/package.json').version"
node -p "require('./server/package.json').version"
rg 'WORKER_VERSION' server/wrangler.toml

# Hosted manifests (after pack / desktop sync)
curl -s https://relaybase.xyz/downloads/worker-install-manifest.json | jq .version
curl -s https://relaybase.xyz/release/latest.json | jq .version
```

Deployed Worker: `GET /health` → `version` should match the install manifest.
