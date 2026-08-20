# Worker install release workflow

Customer-facing Worker installs ship as **pre-built JS bundles** (not TypeScript source).

## Bump and publish

1. Bump version in [`server/package.json`](../package.json) (e.g. `0.2.0` → `0.3.0`).
2. From repo root:
   ```bash
   pnpm pack:worker-install
   ```
3. Commit artifacts under `kembo/website/public/downloads/`:
   - `relaybase-worker-install-{version}.zip`
   - `relaybase-worker-install.zip` (stable alias → latest)
   - `worker-install-manifest.json`
4. Deploy the kembo website so `relaybase.xyz/downloads/*` serves the new files.

## What the pack script produces

| Output | Purpose |
|--------|---------|
| `worker.js` | Wrangler-bundled Worker (all deps inlined) |
| `wrangler.toml` | `main = "worker.js"`, `WORKER_VERSION`, D1/R2 bindings |
| `VERSION` | Plaintext version for staging |
| `worker-install-manifest.json` | `{ version, zipUrl, zipSha256, publishedAt }` |

Desktop auto-install and Worker updates download the manifest, verify SHA-256, unzip, and run `wrangler deploy` — **no `npm install`**.

## Desktop behavior

- **Fresh install:** downloads latest ZIP from manifest → deploy → stores `workerVersion` in `~/.relaybase/credentials.json`.
- **Startup banner:** compares stored version to manifest; prompts update.
- **Settings → Cloudflare:** manual check + “Update Worker” re-deploy.

## Local overrides (dev)

| Env var | Effect |
|---------|--------|
| `RELAYBASE_INSTALL_MANIFEST_URL` | Override manifest URL for desktop auto-install |
