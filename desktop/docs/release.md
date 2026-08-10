# Relaybase desktop release guide

Signed, notarized macOS release with binaries on **Cloudflare R2**
(`download.relaybase.xyz`) and small metadata on `relaybase.xyz/release`.

Pattern mirrors sibling `../kloy/app/docs/release.md`.

---

## Architecture

```text
pnpm run build:macos
  ├─ tauri build --bundles app,dmg  (sign + notarize)
  ├─ sync-release-artifacts.mjs  → website/public/release/
  └─ upload-release-r2.sh        → R2 bucket relaybase-releases
```

| Artifact | Where | Public URL |
|----------|-------|------------|
| `latest.json` | git → website assets | `https://relaybase.xyz/release/latest.json` |
| `Relaybase.<version>.dmg` | R2 `relaybase-releases` | `https://download.relaybase.xyz/Relaybase.<version>.dmg` |
| `Relaybase.<version>.app.tar.gz` | R2 | `https://download.relaybase.xyz/Relaybase.<version>.app.tar.gz` |

---

## Prerequisites

Credentials in `desktop/.env` (gitignored) + `scripts/deploy/apple-signing.env`:

| Variable | Purpose |
|----------|---------|
| `TAURI_SIGNING_PRIVATE_KEY_PATH` | Updater minisign key |
| `APPLE_SIGNING_IDENTITY` / `APPLE_TEAM_ID` | Developer ID |
| `APPLE_API_ISSUER` / `APPLE_API_KEY` / `APPLE_API_KEY_PATH` | Notarization |
| `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` | R2 upload |

R2 (already provisioned):

```text
bucket:  relaybase-releases
CDN:     download.relaybase.xyz  (zone relaybase.xyz)
```

Re-attach custom domain if needed:

```bash
cd website
ZONE_ID="$(curl -s "https://api.cloudflare.com/client/v4/zones?name=relaybase.xyz" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | node -pe 'JSON.parse(require("fs").readFileSync(0)).result[0].id')"
pnpm dlx wrangler@4 r2 bucket domain add relaybase-releases \
  --domain download.relaybase.xyz --zone-id "$ZONE_ID" --min-tls 1.2 --force
```

---

## Build + notarize + R2

```bash
cd desktop
pnpm run build:macos
```

Manual R2 upload:

```bash
bash scripts/deploy/upload-release-r2.sh
```

Dev (unsigned debug):

```bash
pnpm dev
```

---

## Do not commit

```text
website/public/release/Relaybase.*.dmg
website/public/release/Relaybase.*.app.tar.gz
desktop/scripts/deploy/apple-signing.env
desktop/.env
desktop/src-tauri/.tauri-signing/updater.key
```

Do commit: `latest.json`, `artifacts.json`, `.sig`, version bumps, release notes.
