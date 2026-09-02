# Install, Login, and Recovery Lifecycle Specification

**Audience:** Coding agents and developers working on Setup, Cloudflare Worker auto-install, owner authentication, desktop session management, and passtoken recovery.

**Related documents:**
- **[authentication.md](./authentication.md)** — Authentication architecture & token scoping
- **[desktop-session-machine.md](./desktop-session-machine.md)** — Desktop `AppSessionStore` phase machine
- **[storage-architecture.md](./storage-architecture.md)** — D1, R2, and keyring storage layout
- **[d1-migrations-and-init-db.md](./d1-migrations-and-init-db.md)** — Schema initialization & migration contracts
- **[cf-oauth-install-token.md](./cf-oauth-install-token.md)** — Cloudflare OAuth client scopes & tokens

---

## 1. Core Principles

1. **No Deadlock Guarantee**
   - Even if the previous Worker is a legacy build, is broken, or the passtoken was lost, reinstalling or recreating the Worker from Setup **must always issue a new passtoken and recover immediately**.
   - Reinstall must never fail or abort because D1 already has an `owner_config` record (`OWNER_ALREADY_CONFIGURED` and similar errors are forbidden).

2. **Clean State Parity on Worker Install / Reinstall**
   - Setup install or reinstall always generates a new `AUTH_PEPPER` and writes it to the Worker secret.
   - Calling `POST /console/setup-admin` with the in-memory `AUTH_PEPPER` **overwrites** the D1 `owner_config` passtoken hash regardless of whether an owner already exists, revokes all prior sessions, and returns a new passtoken.
   - The new passtoken is shown once in the UI (copy / download) and written to the OS keyring (`owner-passtoken`).

3. **Settings Update Separation**
   - Settings → Worker update (`worker-update`) is for a signed-in owner upgrading the script only. It preserves the existing `AUTH_PEPPER`, D1 passtoken, and sessions (`skip_auth_pepper=true`).

4. **Keyring-First UX**
   - Normal app launch uses the keyring `mail_refresh_token` for a fully silent mailbox boot.
   - When the console session is expired, Touch ID / Windows Hello reads `owner-passtoken` for automatic login.
   - Typed passtoken is allowed only for: (1) first install / connect, (2) biometry failure or cancel, (3) missing keyring data.

---

## 2. Use Case Matrix & Implementation Status

| ID | Use case | Entry path | Desired state | Current implementation | Gap | Status |
|:---|:---|:---|:---|:---|:---|:---|
| **UC-1** | **Clean install** | `/setup/install` (Auto) | Create R2, create 3 D1 databases, deploy Worker, inject new `AUTH_PEPPER`, run `init-db`, then `setup-admin` to issue a new passtoken, show it once, save to keyring | `auto_install_worker` creates resources and runs `init-db`; frontend calls `desktopOwnerSetupAdmin`, shows token UI, saves to keyring | None | Done |
| **UC-2** | **Reinstall with D1 reuse** | `/setup/install` (Reinstall decisions) | Keep R2/D1, redeploy Worker, inject new `AUTH_PEPPER`, run `migrate-db`, then `setup-admin` overwrites D1 `owner_config` and issues a new passtoken | `apply_secrets` injects new pepper; `setupOwner` overwrites D1 and returns new token; `OWNER_ALREADY_CONFIGURED` block removed | None | Done |
| **UC-3** | **Wipe all reinstall** | `/setup/install` (All reinstall + `DELETE ME`) | Delete and recreate R2/D1, redeploy Worker, inject new `AUTH_PEPPER`, run `init-db`, issue new passtoken | Deletes/recreates D1/R2, runs `init-db` → `setup-admin` pipeline | None | Done |
| **UC-4** | **Settings Worker update** | Settings → Update Worker | Keep R2/D1/secrets/passtoken/sessions; silent token refresh via keyring `cf-oauth-install` (zero browser prompt); upload script only; run `migrate-db`; return to dashboard | `update_installed_worker` with `skip_auth_pepper=true` using keyring `refresh_token`; `migrate-db` then dashboard return | None | Done |
| **UC-5** | **Manual Wrangler install** | `/setup/install` (Manual tab) | After terminal deploy, entering Worker URL runs `setup-admin`, issues new D1 passtoken, auto-login | `WorkerInstallPanel` calls `desktopOwnerSetupAdmin` with `installPepper`, overwrites D1, logs in | None | Done |
| **UC-6** | **Already installed connect** | `/setup/connect` | Worker URL + existing passtoken → `POST /console/login` → save to keyring → mailbox | `SetupConnectPage` → `UnlockView` → `store.loginWithPasstoken` → `/email/inbox` | None | Done |
| **UC-7** | **Forgot passtoken reset** | `/setup/recover-admin` | CF OAuth (Secrets Store) → `POST /console/reset-admin` → reissue D1 passtoken | `RecoverAdminPanel` → `desktopOwnerResetAdmin` → `resetOwner` updates D1, revokes sessions, returns new token | None | Done |
| **UC-8** | **Teammate login** | `/setup` (Teammate) | Worker URL + email + mobile password → keyring `team-session:{email}` → team mail shell | `TeamLoginView` → `store.loginInvited` → `team_unlock_cmd` → `invitedReady` | None | Done |
| **UC-9** | **Daily silent boot** | Desktop app launch | Silent mailbox via keyring `owner-session` (`mailRefreshToken`) | `bootFromKeyring` → `owner_boot_mail_cmd` → `ownerReady` + last route restore | None | Done |
| **UC-10** | **Console gate unlock** | Mail → Dashboard | Expired console session → Touch ID reads `owner-passtoken` → auto login → dashboard | `ensureConsoleAccess` → Touch ID → `owner_login_from_keyring_cmd` → console session | None | Done |

---

## 3. Exception & Edge Case Catalog

### EC-1: Broken / legacy Worker + lost passtoken — Setup reinstall (worst-case deadlock)

- **Situation:** Previous Worker is a legacy build without `reset-admin`, or is broken; user lost the passtoken.
- **Old failure:** Setup redeploy stopped with `OWNER_ALREADY_CONFIGURED` because D1 already had `owner_config` → unrecoverable.
- **Desired state:**
  1. Redeploy Worker from Setup and inject a new `AUTH_PEPPER`.
  2. `finalize_schema` completes `migrate-db` using `AUTH_PEPPER`.
  3. `POST /console/setup-admin` with the new `AUTH_PEPPER` **force-overwrites** the previous owner record in D1 with a new passtoken hash.
  4. Show the new passtoken in the UI and write it to the keyring so the user is immediately recovered.
- **Implementation:** `server/src/lib/owner-auth.ts` (`setupOwner`), `desktop/src-tauri/src/auto_install/install.rs` (`apply_secrets`, `finalize_schema`).

### EC-2: `init-db` called when D1 tables already exist

- **Situation:** Reinstall reused D1 but the pipeline called `init-db`.
- **Desired state:**
  1. Worker returns `409 DB_ALREADY_INITIALIZED`.
  2. Desktop treats this as normal reuse and runs `migrate-db` to apply pending schema safely.
- **Implementation:** `server/src/routes/console/init-db.ts`, `desktop/src-tauri/src/auto_install/install.rs` (`finalize_schema`).

### EC-3: Touch ID failure or user cancel

- **Situation:** User cancels Touch ID or fails biometry when opening the dashboard.
- **Desired state:**
  1. Keyring passtoken is never read (security isolation).
  2. Fall back to the typed form (`UnlockView`).
  3. Successful typed passtoken updates keyring state and enters the dashboard.
- **Implementation:** `app/src/lib/desktop/app-session/store.ts` (`loginFromKeyringPasstoken`), `app/src/console/components/setup/UnlockView.tsx`.

### EC-4: Offline app launch

- **Situation:** App starts with no network.
- **Desired state:**
  1. Do not show the passtoken form unnecessarily (typing cannot reach the Worker offline).
  2. Show cached local mailbox and an **Offline** badge in the sidebar.
  3. On `online`, retry silent reconnect in the background.
- **Implementation:** `app/src/lib/desktop/app-session/store.ts` (`markWorkerUnreachable`).

### EC-5: Cloudflare OAuth wrong account or expired token

- **Situation:** OAuth is for a different Cloudflare account than the installed Worker.
- **Desired state:**
  1. `preview_worker_update_target` detects account ID / `workers.dev` URL mismatch.
  2. Surface `WORKER_URL_ACCOUNT_MISMATCH` and tell the user to authorize the correct account.
- **Implementation:** `desktop/src-tauri/src/auto_install/url.rs`, `app/src/lib/desktop/bridge/errors.ts`.

---

## 4. API Endpoint Contracts

### 1. `POST /console/setup-admin`

- **Header:** `X-Auth-Pepper: <AUTH_PEPPER>`
- **Auth:** Valid in-memory `AUTH_PEPPER` proof required.
- **Behavior:**
  1. Verify `X-Auth-Pepper` matches the Worker `AUTH_PEPPER` secret (`401 Unauthorized` on mismatch).
  2. **Regardless of existing D1 `owner_config`**, generate new salt and passtoken (`rb_pass_...`), overwrite `owner_config` (`onConflictDoUpdate`).
  3. Delete all `owner_sessions` (`deleteAllOwnerSessions`).
  4. Return the passtoken plaintext **once** in JSON:
     ```json
     {
       "ok": true,
       "passtoken": "rb_pass_0123456789abcdef...",
       "message": "Copy this passtoken now. It will not be shown again."
     }
     ```
- **Forbidden:** Returning `409 Conflict` or any error solely because an owner already exists.

### 2. `POST /console/init-db`

- **Headers:** `Authorization: Bearer <console-access-token>` OR `X-Cf-Access-Token: <oauth-token>` OR `X-Auth-Pepper: <pepper>`
- **Behavior:** Apply baseline schema on empty D1 only. If any probe table exists, return `409 DB_ALREADY_INITIALIZED`.

### 3. `POST /console/migrate-db`

- **Headers:** `Authorization: Bearer <console-access-token>` OR `X-Cf-Access-Token: <oauth-token>` OR `X-Auth-Pepper: <pepper>`
- **Behavior:** Apply pending migrations only. Never DROP existing tables or data.

### 4. `POST /console/login`

- **Body:** `{ "passtoken": "rb_pass_...", "label": "macOS Desktop" }`
- **Behavior:** Verify passtoken hash → issue `mail` refresh (90d) and `console` refresh (30m) → return mail access token immediately.

### 5. `POST /console/reset-admin`

- **Body:** `{ "cfAccessToken": "...", "cfAccountId": "..." }`
- **Behavior:** Verify Cloudflare OAuth Secrets Store access → reissue D1 passtoken and revoke all sessions.

---

## 5. Keyring & Local Storage Architecture

| Item | Keyring service / account | Contents | Read gate |
|:---|:---|:---|:---|
| **Owner session** | `com.relaybase.desktop` / `owner-session` | `workerUrl`, `refreshToken` (console), `mailRefreshToken` (mail) | **Silent** — auto-read on boot and mailbox entry |
| **Owner passtoken** | `com.relaybase.desktop` / `owner-passtoken` | `rb_pass_...` plaintext | **Touch ID / Windows Hello only** |
| **Teammate session** | `com.relaybase.desktop` / `team-session:{email}` | `workerUrl`, `email`, `mobilePassword` | **Silent** — team shell boot |
| **CF OAuth install refresh** | `com.relaybase.desktop` / `cf-oauth-install` | `refreshToken` (Cloudflare OAuth) | **Silent** — background Worker updates without browser re-auth |
| **API key vault** | `~/.relaybase/{scopeId}/api-keys.json` | API key plaintext | Local file read |

**Never:**
- Store passtoken, access token, or refresh token in `~/.relaybase`, cookies, `localStorage`, or `sessionStorage`.
- Return `owner-passtoken` plaintext from Rust to frontend JavaScript (consume only inside the login transaction).

---

## 6. Forbidden Error Patterns

| Forbidden error / behavior | Why forbidden | Correct replacement |
|:---|:---|:---|
| Return `OWNER_ALREADY_CONFIGURED` and abort | Deadlocks reinstall | Prove `AUTH_PEPPER`, overwrite D1, issue new passtoken immediately |
| Require existing passtoken on reinstall | Unrecoverable if passtoken was lost | Issue new passtoken like first install |
| Show passtoken form on offline boot | Typing cannot authenticate offline | Cached mailbox + Offline badge |
| Require typed passtoken when console refresh expired | Unnecessary typing fatigue | Touch ID reads `owner-passtoken` for auto login |

---

## 7. Implementation & Verification Checklist

- [x] **D1 passtoken overwrite (`server/src/lib/owner-auth.ts`)**
  - Remove `ownerIsConfigured` 409 guard in `setupOwner`; force-save new hash via `onConflictDoUpdate`.
  - Call `deleteAllOwnerSessions(db)` to revoke prior sessions.
- [x] **Schema auth extension (`server/src/lib/auth.ts`)**
  - `requireSchemaAuth` always allows `AUTH_PEPPER` bootstrap regardless of `hasOwner`.
- [x] **Remove `OWNER_ALREADY_CONFIGURED` from install pipeline (`desktop/src-tauri/src/auto_install/install.rs`)**
  - `apply_secrets` always generates new `AUTH_PEPPER` on Setup install/reinstall.
  - Remove pre-check in `finalize_schema` that threw on existing owner.
- [x] **Remove error bridge mapping (`app/src/lib/desktop/bridge/errors.ts`)**
  - Delete `owner_already_configured` / "Owner already configured on this Worker" block.
- [x] **Auto-install passtoken reveal (`app/src/console/components/setup/SetupProgressPanel.tsx`)**
  - On install complete, call `desktopOwnerSetupAdmin` with in-memory `authPepper`; show one-time copy/download UI.
  - Enable Email API dialog and Go to Mailbox after token saved.
- [x] **Manual install UI (`app/src/console/components/setup/WorkerInstallPanel.tsx`)**
  - When `installPepper` is present, issue new passtoken and log in regardless of D1 owner state.
- [x] **Public install bundle refresh (`hq/website/public/downloads/`)**
  - `pnpm pack:worker-install` refreshed `worker.js`, zip, and manifest.
- [x] **Test verification**
  - Server: 53/53 passing.
  - App unit tests passing.
  - Desktop: `cargo test auto_install` 10/10 passing.
