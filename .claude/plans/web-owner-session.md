# Web owner session + `/login` landing

**Status:** ready to implement  
**Repo:** `relaybase-main` (`main/`). Paths below are from this repo root.  
**Date:** 2026-09-14

Read first: `AGENT.md` (desktop live vs web in-dev), `docs/architecture/rust-migration-strategy.md` (N-01 / M-05), `docs/auth/authentication.md`, `docs/architecture/mail-platform-auth.md`.

---

## Goal

1. Web owner sign-in survives a same-tab **hard refresh** (N-01: persist refresh in tab `sessionStorage`, not passtoken).
2. Web unauthenticated landing is **`/login`** (`https://www.relaybase.email/login`), not the install welcome `/setup`.
3. Remove overlapping legacy **`/sign-in`**.
4. Restore Worker URL **Auto dialog** on the web login form (`AccountLoginView`).

---

## Hard constraint — no desktop side effects

Desktop is **live production** (beta customers). Web is **in development, not live**.

This work is web-only. Desktop must behave exactly as today.

- Gate every new persist / restore / redirect with `!isDesktopRuntime()`. Desktop branches stay early-return or untouched.
- **Do not change:** Rust/keyring, `AppSessionStore`, `UnlockView`, `TeamLoginView`, `ConsoleGateView`, desktop `/` → `/setup` welcome, desktop `/login` trampoline (`openInvitedLogin`), desktop `/setup/connect` → `UnlockView`, `owner_boot_mail` / Touch ID, Worker owner-auth protocol, token TTLs, D1 `owner_sessions`.
- Shared files (`owner-session.ts`, `sign-out.ts`, `DesktopDashboardGate.tsx`, `SessionPhaseScreen.tsx`, `app/page.tsx`): add **web-only** blocks. Do not reorder or rewrite the desktop path.
- Do not break `WorkerUrlPicker` API. Restore by **calling** it from `AccountLoginView` only.
- If a desktop user would see a different screen, boot, or logout destination after this PR, the change is wrong. Revert that part.

---

## Background

Web owner tokens live only in module memory (`app/src/lib/desktop/auth/owner-session.ts`) and `window.__RELAYBASE_WORKER_URL__`. A hard reload clears them; `hasWebOwnerSession()` is false; gates send the user to `/setup`.

Team login already persists `sessionStorage` `relaybase:email-session` and survives refresh. Owner has no analogue.

N-01 already says web may keep refresh in tab/session storage (not OS-grade). Code comments and `account-state-d1.md` copied the **desktop** “never persist” rule onto web. Align code + docs with N-01. Do not persist passtoken. Do not use localStorage for tokens. Do not add a BFF cookie for owner JWTs (M-05: browser `fetch` + Bearer).

---

## Work

### 1. Persist owner refresh on web only

- [ ] New `sessionStorage` key `relaybase:owner-session`: `{ workerUrl, mailRefreshToken, consoleRefreshToken }`. Never write access JWT or passtoken.
- [ ] Persist only when `!isDesktopRuntime()`. Desktop: no read/write of this key.
- [ ] On `ownerLogin` / successful `ownerRefresh` (token rotation): overwrite storage. Worker rotates refresh; stale stored refresh 401s after reload.
- [ ] `clearOwnerSession` / `ownerLogout`: remove the key (web).
- [ ] `restoreWebOwnerSession()`: read storage → set `__RELAYBASE_WORKER_URL__` → put refresh in memory → `ownerRefresh("mail")` + `ownerRefresh("console")`. On failure, clear storage.
- [ ] Wire restore into `webOwnerBootMail` (today `ensureAccessToken` on empty memory is a no-op after reload).

Likely files:

- `app/src/lib/desktop/auth/owner-session.ts` (web persist hooks; desktop path unchanged)
- `app/src/lib/desktop/bridge/web-owner-bridge.ts`
- new small helper if cleaner, e.g. `app/src/lib/desktop/auth/web-owner-persist.ts`

### 2. Web gate / boot → `/login` when unauthenticated

- [ ] `DesktopDashboardGate`: if web and memory empty, await restore; if still no session → `/login` (team `getWebTeamAuth()` still → `/inbox`). Desktop branch unchanged (`desktop` gate mode).
- [ ] `app/src/app/page.tsx`: web unauthenticated → `/login`, not `SessionPhaseScreen` → `/setup`. Desktop still uses `SessionPhaseScreen`.
- [ ] `SessionPhaseScreen`: do not send **web** `choice` to `/setup`. Either skip the web redirect block or only run `replace("/setup")` when `isDesktopRuntime()`.
- [ ] `(email-app)/layout.tsx`: unauthenticated → `/login`, not `/setup`. Drop `/sign-in` special-case once that route is gone.

Likely files:

- `app/src/app/_shell/DesktopDashboardGate.tsx`
- `app/src/app/page.tsx`
- `app/src/console/components/setup/SessionPhaseScreen.tsx`
- `app/src/app/(email-app)/layout.tsx`

### 3. `/login` is the web entry; `/sign-in` gone

- [ ] `app/src/app/login/page.tsx`: web renders `AccountLoginView` with **`defaultRole="owner"`**. Still bounce to dashboard/inbox if already signed in. **Desktop:** keep `openInvitedLogin()` → `/`.
- [ ] `AccountLoginView` / `WebInstallFlow`: owner login via `webOwnerLogin({ workerUrl, passtoken })` (persists worker URL credentials). Desktop install/unlock files stay as they are.
- [ ] After web install, `WebInstallFlow` should go to `/login?workerUrl=` not `/setup/connect?workerUrl=`. Desktop `/setup/connect` → `UnlockView` unchanged.
- [ ] Delete `app/src/app/(email-app)/sign-in/page.tsx`. Add a thin `/sign-in` → `/login` redirect for bookmarks (static export + `trailingSlash`).
- [ ] Web `signOutRelaybase`: `ownerLogout` + clear owner/team `sessionStorage` + land on **`/login`**. Desktop `store.signOut()` and redirect helper unchanged (`/setup` or unlock as today).
- [ ] Sidebar / mail settings web sign-out that `replace("/setup")` should go to `/login` **only on web**.

Likely files:

- `app/src/app/login/page.tsx`
- `app/src/console/components/setup/AccountLoginView.tsx`
- `app/src/console/components/setup/WebInstallFlow.tsx`
- `app/src/lib/desktop/auth/sign-out.ts`
- `app/src/components/layout/UserSidebar.tsx` (web-only dest)
- `app/src/email/components/settings/EmailSettingsView.tsx` (web-only dest)
- new `app/src/app/sign-in/page.tsx` or `(email-app)` redirect page if that is how static export should handle it

### 4. Restore Worker URL Auto dialog on web login

`WorkerUrlPicker` + `WorkerUrlInputDialog` already exist and are used by desktop `UnlockView` / `TeamLoginView` / `ConsoleGateView`. **Do not edit those three views.**

- [ ] `AccountLoginView`: replace raw `<Input type="url">` with `WorkerUrlPicker`. Seed from `?workerUrl=` + recents.
- [ ] On successful login call `rememberWorkerUrl()` (`app/src/lib/desktop/worker-url/recent-worker-urls.ts`). Recents are URLs in `localStorage`, not tokens.

### 5. Docs (web policy; do not rewrite desktop rules)

- [ ] `docs/architecture/rust-migration-strategy.md` N-01: access = memory, refresh = `sessionStorage`, passtoken not stored; web landing `/login`; install `/setup`.
- [ ] `docs/auth/authentication.md`: add a **Web owner session** section. Scope “never cookies/localStorage/sessionStorage” to **desktop**.
- [ ] `docs/architecture/account-state-d1.md`: drop “web in-memory-only” as the web auth policy.
- [ ] `docs/architecture/mail-platform-auth.md`: `/sign-in` → `/login`.
- [ ] Update headers in `owner-session.ts` / `web-owner-session.ts` so they no longer forbid web `sessionStorage` for refresh.

---

## Do not touch

- `desktop/src-tauri/**`
- `app/src/lib/desktop/app-session/store.ts`
- `app/src/console/components/setup/UnlockView.tsx`
- `app/src/console/components/setup/TeamLoginView.tsx`
- `app/src/console/components/setup/ConsoleGateView.tsx`
- Worker `owner-auth.ts` / refresh TTL / D1 session schema
- Desktop routing: `/` welcome `/setup`, `/login` invited trampoline, `/setup/connect` UnlockView

---

## Verification

### Web (in-dev)

- `/login` shows Owner (default) + Teammate; Auto tab builds `https://relaybase-api.{account}.workers.dev`.
- Owner login → hard refresh → stay on dashboard (no passtoken again).
- Close tab / sign out → `/login` (not install welcome).
- `/sign-in` redirects to `/login`.
- Footer Install link still opens `/setup` install flow.

### Desktop (live users — regression = fail)

- Fresh app → `/setup` welcome (install / invited). Must **not** become `/login`.
- Keyring present → silent mail boot; Touch ID / console gate unchanged.
- `/login` still trampolines invited login to `/`.
- Unlock / team WorkerUrlPicker still works.
- Sign out still goes to unlock/`/setup`, not web `/login`.

---

## Policy reminder

| Secret | Desktop (unchanged) | Web (this plan) |
|-------|---------------------|-----------------|
| Passtoken | OS keyring + Touch ID | Never persist; re-type after tab close |
| Owner refresh | OS keyring, silent | `sessionStorage` `relaybase:owner-session` |
| Owner access | Process memory | JS memory; remint via `/console/refresh` |
| Team password | Keyring | `sessionStorage` `relaybase:email-session` (already) |
| Unauthenticated home | `/setup` | `/login` |
