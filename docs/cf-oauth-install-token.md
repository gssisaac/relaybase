# Cloudflare OAuth — install token (Settings → Cloudflare)

**Audience:** humans and coding agents changing Settings → Cloudflare, desktop Cloudflare API install, or `hq/console` OAuth routes.

The **install token** (Workers Scripts / R2 / D1 — used by the desktop Cloudflare HTTP API for deploy and Worker secrets) is obtained via **Cloudflare OAuth**, not pasted in Setup or Settings. The **server token** (Email Routing / Zone Read / DNS Edit → Worker `CF_API_TOKEN`) is added by the user in the Cloudflare dashboard after install (optional paste-and-push remains). Sending uses the Worker `EMAIL` binding, not this token.

---

## Worker `CF_ACCOUNT_ID` — optional

**Do not require a Worker `CF_ACCOUNT_ID` secret** for mail, domain, or DNS API readiness. Account id is not a secret (it is in every `dash.cloudflare.com/{id}/…` URL). Duplicating it onto the Worker is what made Enable email API fail when `CF_API_TOKEN` was already live.

| Runtime | Needs `CF_ACCOUNT_ID`? |
|---------|------------------------|
| Inbound (Email Routing → Worker) | No |
| Send (`EMAIL` binding) | No |
| Mail R2 / D1 / search / owner login (`AUTH_PEPPER`) | No |
| Mobile inbox / cron | No |
| Domain / inbox / DNS via `CF_API_TOKEN` | No — zone-scoped APIs. List/import zones for the **pinned** account only (see below) |
| REST Email Sending fallback (`/accounts/{id}/email/sending/send`) | Only if `EMAIL` is missing — discover id from `GET /zones` (`account.id` on the zone) |
| `init-db` / `migrate-db` / `reset-admin` OAuth proof | Optional pin — see below |

**Ready signal** (`GET /console/connect` → `mailApiReady`): `cfApiTokenSet` and `cfApiTokenValid !== false`. Do **not** gate on Worker `accountId`.

**Where account id lives instead**

| Place | Role |
|-------|------|
| `~/.relaybase/workspace.json` `accountId` | Desktop UI links (Worker settings, R2, D1). Fallback when connect omits `accountId`. |
| D1 `owner_config.cf_account_id` | Durable pin for OAuth proof after first successful verify / reset. Prefer this over a wrangler secret. |
| Worker secret `CF_ACCOUNT_ID` | Optional convenience. Desktop auto-install may still PUT it. Absence must not block mail API or verify. |

When the Worker needs an account id (REST send fallback, dashboard links, OAuth proof), resolve in this order: env `CF_ACCOUNT_ID` → D1 `owner_config.cf_account_id` → **`GET /zones` and read `account.id`** (Zone Read — the server token already has this) → `GET /accounts` (Account Read, often missing). Persist a discovered id to D1 when possible.

**Zone list / import is account-scoped.** A user API token often sees zones on every Cloudflare account the user belongs to. `GET /console/zones`, sending health, and `resolveZoneId` must use the pinned account (env → D1). Do **not** invent a pin from the first zone in an unfiltered list — that can lock onto the wrong account. When no pin is available, each zone includes `account.id` so the desktop can filter by the OAuth-selected `workspace.json` `accountId`. A domain on another account must not be offered or onboarded (Email Routing cannot attach that zone to this Worker).

Do **not** store Cloudflare account id or API tokens in HQ ops D1.

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
| `workers-scripts.write` | Worker script upload + Worker secrets (`AUTH_PEPPER`, optional `CF_ACCOUNT_ID`, `CF_API_TOKEN`) |
| `workers-r2.write` | R2 buckets |
| `d1.write` | D1 create + bindings on deploy |

**Recover scopes:** `secrets-store.write` only. The Worker proves the token can list Secrets Store on the pinned CF account (env `CF_ACCOUNT_ID`, D1 `owner_config.cf_account_id`, body `cfAccountId`, or `GET /accounts`). Worker runtime secrets use `workers-scripts.write` on the **install** client only — recover does not request that scope.

Do **not** put **`offline_access`** or KV scopes in the authorize `scope` query. Cloudflare adds `offline_access` itself when the client has the `refresh_token` grant; requesting unregistered scopes makes dash.cloudflare.com show “Relaybase authorization failed”.

**Do not** use API-token permission names in OAuth scope strings (e.g. `workers.scripts.edit` → `invalid_scope`).

---

## Console deployment

`hq/console/wrangler.jsonc` **vars** (public — safe to commit):

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
- `require_cf_oauth` (`desktop/src-tauri/src/cf_oauth.rs`) — only reader for CF commands. Returns `{ access_token, account_id }` from memory, or refreshes when the access token expires within 60s. No session → “Authorize with Cloudflare again”. Forgot-passtoken reset uses `require_cf_oauth_access_token()` instead — the recover client has `secrets-store.write` only, so the desktop cannot resolve `account_id` via `/accounts`; the Worker verifies the token against the pinned CF account (env, D1, or discover).

Settings UI listens for **`cf-oauth-complete`** via `listenCfOAuthResult()` in `app/src/lib/desktop/bridge/oauth.ts` — not tied to staying on the Cloudflare settings page.

---

## Local credentials fields

OAuth access/refresh tokens are **not** written to `workspace.json` — they live in Tauri process memory only and are cleared on app restart. Only the CF account id is persisted on disk:

| Field | Purpose |
|-------|---------|
| `accountId` | CF account id from the OAuth token response (persisted on disk) |

The in-memory OAuth session (`CF_OAUTH_SESSION` in `desktop/src-tauri/src/secrets.rs`) holds `access_token`, `refresh_token`, `access_expires_at`, `account_id`, `client_id` and is overlaid into IPC credentials for the lifetime of the process.

---

## Settings + setup UX

- **Authorize with Cloudflare** — OAuth install token on **Setup → Install** (recommended path). After authorization, the app navigates to **Setup → Progress** and auto-installs (install log + owner passtoken copy). No separate install button.
- **Lost passtoken** — typed unlock fallback → **I forgot my passtoken** (`/setup/recover-admin`). Daily use does not type the passtoken (it lives in OS keyring `owner-passtoken`; Touch ID reads it). Uses the **Pass-token Updater** OAuth client (`secrets-store.write` only). After authorization the app calls `POST /console/reset-admin` with the in-memory OAuth access token. The Worker proves that token can list Secrets Store on the pinned CF account (GET `/accounts/{id}` is a fallback) and re-issues a passtoken once (download + write `owner-passtoken`). No console email recovery.
- **Enable email API** — after install (and in Settings when the API is not configured), a dialog walks the user through creating a Cloudflare API token and adding it themselves as the Worker `CF_API_TOKEN` secret. The app never stores that token on disk in the default path. **I have done this → Verify** calls `GET /console/connect` and requires `cfApiTokenSet` plus `cfApiTokenValid` (Zone Read probe). Worker `accountId` is not required — desktop UI links fall back to `credentials.accountId`.
- **Optional paste & push** — same dialog, folded away. Verify the token locally, then push via the install OAuth session (`put_worker_secret`). The token is not written to disk.
- **Settings → Cloudflare** — dashboard-first Enable email API dialog. OAuth is only requested if the user chooses paste & push and there is no install token in memory.
- **Domains → Refresh from Cloudflare** — lists zones via the Worker (`GET /console/zones`) using `CF_API_TOKEN`, not the in-memory OAuth install token. If the Worker token is missing, the dialog opens Enable email API. If the route 404s (old script), show running vs latest Worker versions and send the user to **Settings → Worker update** (`/settings/worker/update`) — do not offer the install ZIP. Do not add an OAuth flow on that page.
- **Settings → Worker** — Check for updates on the card. **Update Worker** goes to `/settings/worker/update` (same OAuth / Manual + CLI UI as Setup, worker-only copy). After OAuth, the app resolves that account’s `workers.dev` URL and **must match** the saved Worker URL (custom domains match via `/console/connect` `accountId` — env, D1, or empty). Mismatch stops before any upload. Then `/settings/worker/progress` uploads the script and calls **`migrate-db`**, not `init-db`.
- **Manual install** — Worker URL + passtoken inline on the install page; the same Enable email API dialog follows Worker URL verify.
- **Sending** — the Worker `EMAIL` send_email binding, attached at deploy. `CF_API_TOKEN` is for domain / inbox routing / DNS API, not for send. `GET /console/connect` reports `emailBindingConfigured`.
- **Server token source of truth** — the Worker's `CF_API_TOKEN` secret (`cfApiTokenSet` + `cfApiTokenValid`). The desktop does not persist that token.
- Do **not** ask the user to paste a Workers Scripts / R2 API token. Install uses OAuth. Install does not create KV.

Errors use `explainCfOAuthError()`.

---

## File map

| Area | Files |
|------|--------|
| Console config + callback | `hq/console/src/app/api/v1/oauth/config/route.ts`, `hq/console/src/app/oauth/callback/route.ts`, `hq/console/wrangler.jsonc` |
| Desktop Rust | `desktop/src-tauri/src/cf_oauth.rs` (`require_cf_oauth`), `lib.rs`, `secrets.rs`, `auto_install/`, `tauri.conf.json` (`relaybase` scheme), `capabilities/default.json` |
| App bridge + Settings | `app/src/lib/desktop/bridge/`, `SettingsConnectionContext.tsx`, `SettingsCloudflarePage.tsx`, `WorkerUpdateBanner.tsx`, `/settings/worker/update`, `/settings/worker/progress` |
| Enable email API dialog | `app/src/console/components/setup/EnableEmailApiDialog.tsx`, `use-enable-email-api-dialog.tsx` (also opened from Domains → Refresh from Cloudflare when `GET /console/zones` reports the Worker token missing) |
| Zone list (Refresh from Cloudflare) | `GET /console/zones` (`server/src/routes/console/zones.ts`) via `listCloudflareZones` — Worker `CF_API_TOKEN`, not desktop OAuth |
| Setup install wizard | `app/src/console/components/setup/WorkerInstallPanel.tsx`, `SetupProgressPanel.tsx`, `app/src/app/setup/progress/page.tsx` |
| Passtoken reissue (forgot) | `app/src/console/components/setup/RecoverAdminPanel.tsx`, `app/src/app/setup/recover-admin/page.tsx` → `desktopStartCfOAuth("recover")` → `POST /console/reset-admin` (Secrets Store on the pinned CF account) |

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| `invalid_scope` or Cloudflare “authorization failed” | Scope strings in `/config` don’t match that purpose’s OAuth client (install must not request `secrets-store.write`; recover must request only `secrets-store.write`). Do not request `offline_access` or KV. |
| `Worker is missing CF_ACCOUNT_ID` after Authorize | Latest Worker does not require the secret. Ensure `accountId` is in `~/.relaybase/workspace.json`, or pass `cfAccountId` in the reset body. |
| Browser “Finishing connection…” but app stays **Not connected** | `tauri dev` without loopback listener — restart desktop after pulling; ensure port **32831** is free. |
| `Token endpoint did not return a refresh_token` | Missing `refresh_token` grant or `offline_access` on authorize — fixed in code (connection succeeds with access token only); enable **Refresh Token** grant on the client for auto-refresh. |
| `relaybase://` does nothing | Expected in dev; loopback should succeed. In production, install the bundled `.app` so the URL scheme is registered. |
| `R2_SUBSCRIPTION_REQUIRED` / API `10042` / “enable R2” | Account has no R2 product — never enabled, or Cloudflare dropped the unused $0 subscription after a few days. Install checks this **before** deleting/creating resources. Send the user to `https://dash.cloudflare.com/{account_id}/r2` (overview, **not** `/r2/checkout/payment`). |
