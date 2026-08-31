# Cloudflare OAuth — install token (Settings → Cloudflare)

**Audience:** humans and coding agents changing Settings → Cloudflare, desktop Cloudflare API install, or `kembo/console` OAuth routes.

The **install token** (Workers Scripts / R2 / D1 — used by the desktop Cloudflare HTTP API for deploy and Worker secrets) is obtained via **Cloudflare OAuth**, not pasted in Setup or Settings. The **server token** (Email Sending Edit / Email Routing / Zone Read → Worker `CF_API_TOKEN`) is added by the user in the Cloudflare dashboard after install (optional paste-and-push remains). Sending uses the Worker `EMAIL` binding, not this token.

---

## Architecture

| Piece | Role |
|-------|------|
| **Cloudflare OAuth clients** | Two public PKCE clients on the operator’s CF account. Grant types: `authorization_code` + **`refresh_token`**. Token auth: **None (PKCE)**. Shared redirect URI: `https://console.relaybase.xyz/oauth/callback`. **Relaybase** (`CF_OAUTH_CLIENT_ID`) — Workers / R2 / D1 for install and Worker update. **Relaybase Pass-token Updater** (`CF_OAUTH_PASSTOKEN_CLIENT_ID`) — `secrets-store.write` only for forgot-passtoken reset. |
| **`console.relaybase.xyz`** | Public `/api/v1/oauth/config?purpose=install\|recover` (client id, redirect URI, scope list). `/oauth/callback` relays `code` + `state` to the desktop — **no token exchange on the console**, no CF user credentials stored in D1 `strum-relaybase-ops`. |
| **Desktop (Tauri)** | Fetches config, runs PKCE authorize in the system browser, receives callback, exchanges `code` + `code_verifier` with `https://dash.cloudflare.com/oauth2/token`, holds tokens in **process memory only** (`CF_OAUTH_SESSION`). All Cloudflare API / Worker `X-Cf-Access-Token` calls go through `require_cf_oauth()` in `desktop/src-tauri/src/cf_oauth.rs` — memory if the access token has ≥60s left, otherwise the Cloudflare token endpoint. App restart clears the session. |
| **`~/.relaybase`** | Stores only the resolved CF account id (from the OAuth response). OAuth access/refresh tokens are **not** persisted — they live in Tauri memory only. See **[relaybase-home-storage.md](./relaybase-home-storage.md)**. |

No KV, no D1, and no Relaybase console **session** is required to connect Cloudflare.

---

## OAuth client setup (Cloudflare dashboard)

Create **Manage account → OAuth clients → Create client** (two clients):

| Setting | Install (`Relaybase`) | Recover (`Relaybase Pass-token Updater`) |
|---------|------------------------|------------------------------------------|
| Response type | `Code` | `Code` |
| Grant type | `Authorization Code` **and** `Refresh Token` | same |
| Token authentication | **None (PKCE)** | **None (PKCE)** |
| Redirect URL | `https://console.relaybase.xyz/oauth/callback` | same |

Public clients need a `cloudflare_oauth_client_publisher=…` TXT on the `client_uri` domain (one record per client). Cloudflare polls until verified.

**Install scopes** (Developer Platform — hyphenated `.write` IDs):

| Scope ID | Purpose |
|----------|---------|
| `workers-scripts.write` | Worker script upload + Worker secrets (`AUTH_PEPPER`, `CF_ACCOUNT_ID`, `CF_API_TOKEN`) |
| `workers-r2.write` | R2 buckets |
| `d1.write` | D1 create + bindings on deploy |

**Recover scopes:** `secrets-store.write` only. The Worker proves the token can `GET /accounts/{CF_ACCOUNT_ID}/secrets_store/stores`. Worker secrets still go through `PUT /workers/scripts/{name}/secrets` (`workers-scripts.write`) — recover does not write Cloudflare secrets.

Do **not** put **`offline_access`** or KV scopes in the authorize `scope` query. Cloudflare adds `offline_access` itself when the client has the `refresh_token` grant; requesting unregistered scopes makes dash.cloudflare.com show “Relaybase authorization failed”.

**Do not** use API-token permission names in OAuth scope strings (e.g. `workers.scripts.edit` → `invalid_scope`).

---

## Console deployment

`kembo/console/wrangler.jsonc` **vars** (public — safe to commit):

```jsonc
"vars": {
  "CF_OAUTH_CLIENT_ID": "<install-client-id>",
  "CF_OAUTH_PASSTOKEN_CLIENT_ID": "<recover-client-id>",
  "CF_OAUTH_REDIRECT_URI": "https://console.relaybase.xyz/oauth/callback"
}
```

After changing a client id, redeploy `strum-relaybase-console`. No `CF_OAUTH_CLIENT_SECRET` — PKCE public clients.

**Routes:**

| Route | Purpose |
|-------|---------|
| `GET /api/v1/oauth/config?purpose=install\|recover` | `{ clientId, redirectUri, scopes, purpose }` for the desktop (`install` is the default) |
| `GET /oauth/callback` | Browser landing; delivers `code` + `state` to the app (see below) |

---

## Desktop callback — dev vs production

Cloudflare redirects the browser to `console.relaybase.xyz/oauth/callback`. That page:

1. **`fetch`** `http://127.0.0.1:32831/oauth/callback?code=…&state=…` (CORS-open). The Tauri app always listens on this loopback port (`tauri dev` and bundled `.app`). **Required for `tauri dev`** — macOS often does not register `relaybase://` for unsigned dev binaries.
2. If loopback fails, **`window.location`** to `relaybase://oauth/callback?…` (works for installed `.app` with registered URL scheme).

Only one Relaybase process can bind `127.0.0.1:32831`. If **Applications/Relaybase.app** is running while you use `tauri:dev`, the browser callback hits the installed app and the dev window waits forever. `start_cf_oauth` now fails immediately with a “quit Relaybase.app” error when the port is taken; retry Authorize after quitting the other window.

Rust:

- `start_cf_oauth(purpose)` / `complete_cf_oauth` (`desktop/src-tauri/src/lib.rs`) — PKCE authorize + token exchange; writes `CF_OAUTH_SESSION` (includes the client id used, so refresh stays on that client)
- Loopback server + `tauri-plugin-deep-link` — complete exchange, emit `cf-oauth-complete` / `cf-oauth-error`
- `require_cf_oauth` (`desktop/src-tauri/src/cf_oauth.rs`) — only reader for CF commands. Returns `{ access_token, account_id }` from memory, or refreshes when the access token expires within 60s. No session → “Authorize with Cloudflare again”.

Settings UI listens for **`cf-oauth-complete`** via `listenCfOAuthResult()` in `app/src/lib/desktop/bridge/oauth.ts` — not tied to staying on the Cloudflare settings page.

---

## Local credentials fields

OAuth access/refresh tokens are **not** written to `credentials.json` — they live in Tauri process memory only and are cleared on app restart. Only the CF account id is persisted on disk:

| Field | Purpose |
|-------|---------|
| `accountId` | CF account id from the OAuth token response (persisted on disk) |

The in-memory OAuth session (`CF_OAUTH_SESSION` in `desktop/src-tauri/src/secrets.rs`) holds `access_token`, `refresh_token`, `access_expires_at`, `account_id`, `client_id` and is overlaid into IPC credentials for the lifetime of the process.

---

## Settings + setup UX

- **Authorize with Cloudflare** — OAuth install token on **Setup → Install** (recommended path). After authorization, the app navigates to **Setup → Progress** and auto-installs (install log + owner passtoken copy). No separate install button.
- **Lost passtoken** — typed unlock fallback → **I forgot my passtoken** (`/setup/recover-admin`). Daily use does not type the passtoken (it lives in OS keyring `owner-passtoken`; Touch ID reads it). Uses the **Pass-token Updater** OAuth client (`secrets-store.write` only). After authorization the app calls `POST /console/reset-admin` with the in-memory OAuth access token. The Worker proves that token can list Secrets Store on `CF_ACCOUNT_ID` (GET `/accounts/{id}` is a fallback) and re-issues a passtoken once (download + write `owner-passtoken`). No console email recovery.
- **Enable email API** — after install (and in Settings when the API is not configured), a dialog walks the user through creating a Cloudflare API token and adding it themselves as the Worker `CF_API_TOKEN` secret. The app never stores that token on disk in the default path. **I have done this → Verify** calls `GET /console/connect` and requires `cfApiTokenSet` plus `cfApiTokenValid` (Zone Read probe).
- **Optional paste & push** — same dialog, folded away. Verify the token locally, then push via the install OAuth session (`put_worker_secret`). The token is not written to disk.
- **Settings → Cloudflare** — dashboard-first Enable email API dialog. OAuth is only requested if the user chooses paste & push and there is no install token in memory.
- **Domains → Refresh from Cloudflare** — lists zones via the Worker (`GET /console/zones`) using `CF_API_TOKEN` + `CF_ACCOUNT_ID`, not the in-memory OAuth install token. If the Worker secret is missing, the dialog opens Enable email API. If the route 404s (old script), show running vs latest Worker versions and send the user to **Settings → Worker update** (`/settings/worker/update`) — do not offer the install ZIP. Do not add an OAuth flow on that page.
- **Settings → Worker** — Check for updates on the card. **Update Worker** goes to `/settings/worker/update` (same OAuth / Manual + CLI UI as Setup, worker-only copy). After OAuth, the app resolves that account’s `workers.dev` URL and **must match** the saved Worker URL (custom domains match via `/console/connect` `accountId`). Mismatch stops before any upload. Then `/settings/worker/progress` uploads the script and calls **`migrate-db`**, not `init-db`.
- **Manual install** — Worker URL + passtoken inline on the install page; the same Enable email API dialog follows Worker URL verify.
- **Sending** — the Worker `EMAIL` send_email binding, attached at deploy. `CF_API_TOKEN` is for domain / inbox routing / DNS API, not for send. `GET /console/connect` reports `emailBindingConfigured`.
- **Server token source of truth** — the Worker's `CF_API_TOKEN` secret (`cfApiTokenSet` + `cfApiTokenValid`). The desktop does not persist that token.
- Do **not** ask the user to paste a Workers Scripts / R2 API token. Install uses OAuth. Install does not create KV.

Errors use `explainCfOAuthError()`.

---

## File map

| Area | Files |
|------|--------|
| Console config + callback | `kembo/console/src/app/api/v1/oauth/config/route.ts`, `kembo/console/src/app/oauth/callback/route.ts`, `kembo/console/wrangler.jsonc` |
| Desktop Rust | `desktop/src-tauri/src/cf_oauth.rs` (`require_cf_oauth`), `lib.rs`, `secrets.rs`, `auto_install/`, `tauri.conf.json` (`relaybase` scheme), `capabilities/default.json` |
| App bridge + Settings | `app/src/lib/desktop/bridge/`, `SettingsConnectionContext.tsx`, `SettingsCloudflarePage.tsx`, `WorkerUpdateBanner.tsx`, `/settings/worker/update`, `/settings/worker/progress` |
| Enable email API dialog | `app/src/console/components/setup/EnableEmailApiDialog.tsx`, `use-enable-email-api-dialog.tsx` (also opened from Domains → Refresh from Cloudflare when `GET /console/zones` reports the Worker token missing) |
| Zone list (Refresh from Cloudflare) | `GET /console/zones` (`server/src/routes/console/zones.ts`) via `listCloudflareZones` — Worker `CF_API_TOKEN`, not desktop OAuth |
| Setup install wizard | `app/src/console/components/setup/WorkerInstallPanel.tsx`, `SetupProgressPanel.tsx`, `app/src/app/setup/progress/page.tsx` |
| Passtoken reissue (forgot) | `app/src/console/components/setup/RecoverAdminPanel.tsx`, `app/src/app/setup/recover-admin/page.tsx` → `desktopStartCfOAuth("recover")` → `POST /console/reset-admin` (Secrets Store on `CF_ACCOUNT_ID`) |

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| `invalid_scope` or Cloudflare “authorization failed” | Scope strings in `/config` don’t match that purpose’s OAuth client (install must not request `secrets-store.write`; recover must request only `secrets-store.write`). Do not request `offline_access` or KV. |
| Browser “Finishing connection…” but app stays **Not connected** | `tauri dev` without loopback listener — restart desktop after pulling; ensure port **32831** is free. |
| `Token endpoint did not return a refresh_token` | Missing `refresh_token` grant or `offline_access` on authorize — fixed in code (connection succeeds with access token only); enable **Refresh Token** grant on the client for auto-refresh. |
| `relaybase://` does nothing | Expected in dev; loopback should succeed. In production, install the bundled `.app` so the URL scheme is registered. |
| `R2_SUBSCRIPTION_REQUIRED` / API `10042` / “enable R2” | Account has no R2 product — never enabled, or Cloudflare dropped the unused $0 subscription after a few days. Install checks this **before** deleting/creating resources. Send the user to `https://dash.cloudflare.com/{account_id}/r2` (overview, **not** `/r2/checkout/payment`). |
