# Cloudflare OAuth — install token (Settings → Cloudflare)

**Audience:** humans and coding agents changing Settings → Cloudflare, desktop wrangler auth, or `kembo/console` OAuth routes.

The **install token** (Workers Scripts / KV / R2 / D1 / Secrets Store — used by Tauri `wrangler` for deploy and `secret put`) is obtained via **Cloudflare OAuth**, not pasted in Setup or Settings. The **server token** (Email Sending Edit → Worker `CF_API_TOKEN`) is a manual paste in Settings after install.

---

## Architecture

| Piece | Role |
|-------|------|
| **Cloudflare OAuth client** | One public PKCE client on the operator’s CF account. Grant types: `authorization_code` + **`refresh_token`**. Token auth: **None (PKCE)**. Redirect URI: `https://console.relaybase.xyz/oauth/callback`. |
| **`console.relaybase.xyz`** | Public `/api/v1/oauth/config` (client id, redirect URI, scope list). `/oauth/callback` relays `code` + `state` to the desktop — **no token exchange on the console**, no CF user credentials stored in D1 `kembo-ops`. |
| **Desktop (Tauri)** | Fetches config, runs PKCE authorize in the system browser, receives callback, exchanges `code` + `code_verifier` with `https://dash.cloudflare.com/oauth2/token`, saves tokens to `~/.relaybase/credentials.json`. Keeps `installToken` in sync with the OAuth access token for existing wrangler call sites. |
| **`~/.relaybase`** | Sole store for OAuth access/refresh tokens and resolved CF account id. See **[relaybase-home-storage.md](./relaybase-home-storage.md)**. |

No KV, no D1, and no Relaybase console **session** is required to connect Cloudflare.

---

## OAuth client setup (Cloudflare dashboard)

Create **Manage account → OAuth clients → Create client**:

| Setting | Value |
|---------|--------|
| Client name | e.g. `Relaybase` |
| Response type | `Code` |
| Grant type | `Authorization Code` **and** `Refresh Token` |
| Token authentication | **None (PKCE)** |
| Redirect URL | `https://console.relaybase.xyz/oauth/callback` |

**Scopes** (Developer Platform — use the dashboard IDs, hyphenated `.write`):

| Scope ID | Purpose |
|----------|---------|
| `workers-scripts.write` | Wrangler deploy / script edit |
| `workers-r2.write` | R2 buckets |
| `secrets-store.write` | `wrangler secret put` (e.g. `CF_API_TOKEN`) |
| `d1.write` | D1 bindings on deploy |

Do **not** put **`offline_access`** or KV scopes in the authorize `scope` query. Cloudflare adds `offline_access` itself when the client has the `refresh_token` grant; requesting unregistered scopes makes dash.cloudflare.com show “Relaybase authorization failed”.

**Do not** use API-token permission names in OAuth scope strings (e.g. `workers.scripts.edit` → `invalid_scope`).

---

## Console deployment

`kembo/console/wrangler.jsonc` **vars** (public — safe to commit):

```jsonc
"vars": {
  "CF_OAUTH_CLIENT_ID": "<client-id-from-dashboard>",
  "CF_OAUTH_REDIRECT_URI": "https://console.relaybase.xyz/oauth/callback"
}
```

After changing the client id, redeploy `kembo-console`. No `CF_OAUTH_CLIENT_SECRET` — PKCE public client.

**Routes:**

| Route | Purpose |
|-------|---------|
| `GET /api/v1/oauth/config` | `{ clientId, redirectUri, scopes }` for the desktop |
| `GET /oauth/callback` | Browser landing; delivers `code` + `state` to the app (see below) |

---

## Desktop callback — dev vs production

Cloudflare redirects the browser to `console.relaybase.xyz/oauth/callback`. That page:

1. **`fetch`** `http://127.0.0.1:32831/oauth/callback?code=…&state=…` (CORS-open). The Tauri app always listens on this loopback port (`tauri dev` and bundled `.app`). **Required for `tauri dev`** — macOS often does not register `relaybase://` for unsigned dev binaries.
2. If loopback fails, **`window.location`** to `relaybase://oauth/callback?…` (works for installed `.app` with registered URL scheme).

Rust (`desktop/src-tauri/src/lib.rs`):

- `start_cf_oauth` — fetch config, PKCE verifier/challenge, open authorize URL
- Loopback server + `tauri-plugin-deep-link` — complete exchange, emit `cf-oauth-complete` / `cf-oauth-error`
- `refresh_install_token_if_needed` — refresh via Cloudflare token endpoint when `cfOauthRefreshToken` is set; no-op if only access token (legacy manual install token path unchanged)

Settings UI listens for **`cf-oauth-complete`** via `listenCfOAuthResult()` in `app/src/lib/desktop/bridge.ts` — not tied to staying on the Cloudflare settings page.

---

## Local credentials fields

Added to `credentials.json` (camelCase in JSON):

| Field | Purpose |
|-------|---------|
| `cfOauthAccessToken` | Short-lived access token (mirrored in `installToken`) |
| `cfOauthRefreshToken` | Refresh token when issued; empty if user must re-connect after expiry |
| `cfOauthAccessExpiresAt` | ISO expiry |
| `cfOauthAccountId` | CF account id from token response (also `accountId`) |

---

## Settings + setup UX

- **Connect with Cloudflare** — OAuth install token only; no Relaybase account login required. Used on **Setup → Install** (recommended path) and **Settings → Cloudflare**.
- **Server token** — still manual (Email Sending Edit) in Settings after install; required to send mail. **Verify, save & push** requires OAuth connected first.
- Do **not** ask the user to paste a Workers Scripts / KV / R2 API token. That legacy field is replaced by OAuth.

Errors use `explainCfOAuthError()` — not the legacy “Admin token rejected” / install ZIP messaging.

---

## File map

| Area | Files |
|------|--------|
| Console config + callback | `kembo/console/src/app/api/v1/oauth/config/route.ts`, `kembo/console/src/app/oauth/callback/route.ts`, `kembo/console/wrangler.jsonc` |
| Desktop Rust | `desktop/src-tauri/src/lib.rs`, `secrets.rs`, `tauri.conf.json` (`relaybase` scheme), `capabilities/default.json` |
| App bridge + Settings | `app/src/lib/desktop/bridge.ts`, `SettingsConnectionContext.tsx`, `SettingsCloudflarePage.tsx` |
| Setup install wizard | `app/src/dashboard/components/WorkerInstallPanel.tsx`, `SetupStepTwo.tsx` |

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| `invalid_scope` or Cloudflare “authorization failed” | Scope strings in `/config` don’t match the OAuth client (use hyphenated `.write` IDs; do not request `offline_access` or KV). |
| Browser “Finishing connection…” but app stays **Not connected** | `tauri dev` without loopback listener — restart desktop after pulling; ensure port **32831** is free. |
| `Token endpoint did not return a refresh_token` | Missing `refresh_token` grant or `offline_access` on authorize — fixed in code (connection succeeds with access token only); enable **Refresh Token** grant on the client for auto-refresh. |
| `relaybase://` does nothing | Expected in dev; loopback should succeed. In production, install the bundled `.app` so the URL scheme is registered. |
