# Cloud entry auth (username + OAuth)

**Status:** Active (web-first). Desktop legacy passtoken flows remain until migrated.

## User-facing flows

| Flow | URL | Mechanism |
|------|-----|-----------|
| Sign up | `/signup` | CF OAuth → web install (`cloudSignup=1`) → username + password |
| Sign in | `/login` | Username + password → HQ Studio refresh cookie |
| Forgot password | `/forgot-password` | CF OAuth account match → new password |

Passtoken is issued during signup on the server (`/api/auth/register-cloud` → Worker `setup-admin`) and stored encrypted in `hq/studio/data/auth.json` (`passtokenEnc`). It is **not** shown or stored in the browser.

## API (hq/studio)

| Route | Purpose |
|-------|---------|
| `GET /auth/check-username` | Username availability |
| `GET /auth/suggest-username?cfAccountId=` | Default username suggestion |
| `POST /auth/signup/cloud` | Internal-only cloud signup (header `X-Relaybase-Internal-Auth`) |
| `POST /auth/reset-password/oauth` | Internal-only CF OAuth password reset |
| `POST /auth/login` | Body `{ username, password }` (legacy `email` still works) |

## App routes

| Route | Purpose |
|-------|---------|
| `POST /api/auth/register-cloud` | CF session + install token → setup-admin → studio signup |
| `POST /api/auth/reset-password-oauth` | CF session → studio password reset |

Legacy redirects: `/studio/login`, `/studio/signup`, `/worker/login` → `/login` or `/signup`.
