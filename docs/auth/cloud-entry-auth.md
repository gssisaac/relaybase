# Cloud entry auth (username + OAuth)

**Status:** Active — single web auth root for Studio, Console, and Mailbox.

## User-facing flows

| Flow | URL | Mechanism |
|------|-----|-----------|
| Sign up | `/signup` → `/signup/check` → `/signup/probe` → `/signup/install` → `/signup/account` | CF OAuth → account/probe gates → modular install → username + password |
| Sign in | `/login` | Username + password → HQ refresh cookie + Worker session exchange |
| Forgot password | `/forgot-password` | CF OAuth account match → new password |

Passtoken is created during signup on the server (`/api/auth/register-cloud` → Worker `setup-admin` → `POST /auth/signup/cloud`) and stored encrypted (`passtokenEnc`). It is **never** shown or stored in the browser.

After HQ login (or refresh), the app calls **`POST /auth/worker-session`** so mail and console API calls use scoped Worker tokens without user-visible passtoken or team mobile passwords.

## API (hq/studio)

| Route | Purpose |
|-------|---------|
| `GET /auth/check-username` | Username availability |
| `GET /auth/suggest-username?cfAccountId=` | Default username suggestion |
| `POST /auth/signup/cloud` | Internal-only cloud signup (`X-Relaybase-Internal-Auth`) |
| `POST /auth/reset-password/oauth` | Internal-only CF OAuth password reset |
| `POST /auth/login` | `{ username, password }` (legacy `email` still accepted) |
| `POST /auth/refresh` | Rotate refresh cookie (RTR) |
| `POST /auth/worker-session` | Authenticated HQ JWT → Worker owner token bundle |

### `POST /auth/worker-session` response

```json
{
  "workerUrl": "https://….workers.dev",
  "mailAccessToken": "…",
  "mailRefreshToken": "…",
  "consoleRefreshToken": "…",
  "mailExpiresIn": 600
}
```

Server decrypts `passtokenEnc`, calls Worker `POST /console/login`, returns tokens only.

## App routes

| Route | Purpose |
|-------|---------|
| `POST /api/auth/register-cloud` | CF session + install token → setup-admin → studio signup |
| `POST /api/auth/reset-password-oauth` | CF session → studio password reset |

## Web session layers

| Layer | Storage | Used for |
|-------|---------|----------|
| HQ refresh | HttpOnly cookie | `/auth/refresh`, 30-day sign-in |
| HQ access JWT | JS memory | Studio API, `/auth/worker-session` |
| Worker owner refresh | JS memory + tab `sessionStorage` via `web-owner-persist` | `/mail/*`, `/console/*` via `owner-session` |

Logout (`cloudLogout`) clears HQ memory, revokes cookie, and clears Worker owner sessions.

## Legacy redirects

| Old URL | Redirect |
|---------|----------|
| `/studio/login`, `/studio/signup` | `/login`, `/signup` |
| `/worker/login` | `/login` |
| `/recover-admin`, `/reset-password` | `/forgot-password` |
| `/setup/*` (web only) | `/signup` |

## File map

| Area | Path |
|------|------|
| Auth UI | `app/src/features/auth/` |
| Cloud session | `app/src/lib/auth/cloud-session.ts` |
| Worker bridge | `app/src/lib/auth/cloud-worker-session.ts` |
| Shell gate | `app/src/app/_shell/DesktopDashboardGate.tsx` |
| Studio worker session | `hq/studio/src/lib/auth/worker-owner-session.ts` |
| Vault | `hq/studio/src/lib/vault/passtoken-vault.ts` |

## Production URLs

| Service | URL |
|---------|-----|
| Web app | `https://relaybase.email` (`hq-relaybase-web-app`) |
| Studio API | `https://studio-api.relaybase.email` (`hq-relaybase-studio`) |
| Web → Studio proxy | `STUDIO_UPSTREAM_URL` on web Worker = Studio API origin |

Browser clients call same-origin `/auth/*` and `/studio/*` on `relaybase.email`; middleware forwards to `studio-api.relaybase.email`. Server routes (e.g. `register-cloud`) call `STUDIO_UPSTREAM_URL` directly.

## Environment

| Secret / var | Where |
|--------|--------|
| `HQ_JWT_SECRET` | Web app + HQ Studio (must match) |
| `HQ_INTERNAL_AUTH_SECRET` | Web app register/reset + Studio internal routes |
| `HQ_VAULT_SECRET` (optional) | Passtoken encryption; falls back to JWT secret |
| `HQ_AUTH_APP_URL` | Studio service (Railway) → `https://relaybase.email` |
| `STUDIO_PUBLIC_BASE_URL` | Studio service → public mail links (default web app origin) |
| `STUDIO_UPSTREAM_URL` | Web Worker var → Studio API origin (Railway public URL or custom domain) |
