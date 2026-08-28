# Desktop session state machine

Daily launch unlocks mail **silently** from the OS keyring (no Touch ID).
The passtoken form is first-login and fallback only. Console dashboard access
is gated separately via Touch ID at dashboard entry — see `ConsoleGateView` /
`ensureConsoleAccess()`.

**Audience:** humans and coding agents changing the desktop app's
authentication / unlock flow, the owner or invited (team) session, or anything
that decides "who can enter the app right now".

For where the secrets live (keyring, `~/.relaybase`), see
**[relaybase-home-storage.md](./relaybase-home-storage.md)** → *OS keyring*.
For the remote owner auth model (passtoken + scoped sessions, `AUTH_PEPPER`), see
**[storage-architecture.md](./storage-architecture.md)** → *Owner auth* and
**[authentication.md](./authentication.md)**.

---

## Why a state machine

The desktop app has three entry stories — **owner daily unlock**,
**invited (team) login/unlock**, and **first-time install** — that used to be
spread across `DesktopDashboardGate`, unlock panels, and a global 401 handler.
Everything now flows through one MobX store, **`AppSessionStore`**
(`app/src/lib/desktop/app-session/store.ts`), exposed via
**`AppSessionProvider`** (`app/src/lib/desktop/app-session/context.tsx`).

## The phases

`AppSessionPhase` (discriminated union on `kind`):

| Phase | Meaning |
|-------|---------|
| `boot` | Window just opened; keyring status not yet fetched. |
| `choice` | Nothing enrolled (no worker URL, no keyring secret) → welcome. |
| `install` | First-time install: `oauth` → `progress` → `createOwner` → `revealPasstoken`. |
| `invitedLogin` | Invited teammate, no keyring secret yet → `TeamLoginView` (Worker URL + account email + mobile password). |
| `unlock` | No in-memory mail access yet. `role: owner \| invited`, `mode: secret` only. |
| `invitedReady` | Invited session unlocked — render the team (mailbox-only) shell. |
| `ownerReady` | Owner mail session unlocked — render the admin shell (mail routes). |
| `ownerRecover` | Owner forgot passtoken → CF OAuth + `/console/reset-admin`. |

Console dashboard access is **not** a phase — it is tracked via
`ownerStatus.hasConsoleAccess` and the `consoleGateOpen` overlay
(`ConsoleRouteGate` / `ConsoleGateView`).

## Boot — silent mail unlock

`AppSessionProvider` mounts at the **root layout** and fetches owner + team
keyring status in parallel:

```ts
const [ownerStatus, teamStatus] = await Promise.all([
  desktopOwnerSessionStatus(),
  desktopTeamSessionStatus(),
]);
store.setStatuses(ownerStatus, teamStatus);
```

`setStatuses` → `bootFromKeyring()`:

- **Owner** with `mail_refresh_token` but no mail access → `owner_boot_mail`
  (silent, no Touch ID) → `ownerReady` when Worker URL is connected.
- **Invited** with keyring secret but no access → `team_unlock` (silent) →
  `invitedReady`.
- No keyring → `unlock { mode: "secret" }` (passtoken / mobile password form).

Touch ID / Windows Hello runs **only** when entering the dashboard via
`ensureConsoleAccess()` (sidebar switch, last-route restore to dashboard, or
`ConsoleRouteGate` on a dashboard pathname).

## Owner vs invited — scoped sessions

| | Owner mail (boot) | Owner console (dashboard) | Invited daily |
|---|---|---|---|
| Keyring account | `owner-session` | same blob, `refresh_token` = console refresh | `team-session:{email}` |
| Keyring secret | `mail_refresh_token` (long TTL) | `refresh_token` (30 min TTL) | `mobilePassword` |
| Unlock action | `owner_boot_mail` | `owner_unlock_console` after Touch ID | `team_unlock` (silent) |
| Worker scope | `/mail/*` mail access JWT | `/console/*` console access JWT | `/mobile/*` mobile password |
| First-time | install → `setup-admin` → reveal passtoken | same login mints both refreshes | `invitedLogin` → `invitedReady` |
| Recover | `ownerRecover` → CF OAuth → `/console/reset-admin` | n/a | n/a (admin re-issues mobile password) |

Both roles use the same `unlock` phase and the same `UnlockView` for the secret
form; the store drives the difference via `role`.

## Console gate

Dashboard entry points call `store.ensureConsoleAccess()` before navigate:

- `UserSidebar.switchMode("dashboard")`
- `RestoreLastRoute` when the saved path is dashboard
- `ConsoleRouteGate` blocks dashboard children when `!hasConsoleAccess`

Flow:

1. Console refresh valid → Touch ID → `owner_unlock_console` → dashboard renders.
2. Console refresh missing/expired → `ConsoleGateView` passtoken re-login.

## 401 handling

Scoped by Worker path prefix in `api-base.ts`:

| Path | Event | Store handler |
|------|-------|---------------|
| `/mail/*` | `relaybase:unauthorized` | `handleWorkerUnauthorized()` — silent `owner_boot_mail` retry |
| `/console/*` | `relaybase:console-unauthorized` | `handleConsoleUnauthorized()` — open console gate |

Neither handler wipes the worker URL or keyring.

## Gate

`app/src/app/_shell/DesktopDashboardGate.tsx` is a `switch` over `store.phase`:

- `boot` / `choice` / `install` / `ownerRecover` → setup chrome / redirects
- `invitedLogin` → `TeamLoginView` (sole teammate login; `/login` trampoline; legacy `/setup/account` redirects here)
- `unlock` → `UnlockView` (secret form only; always shows Worker URL select)
- `invitedReady` → team (mailbox-only) `DashboardShell`
- `ownerReady` → admin `DashboardShell` wrapped in `ConsoleRouteGate`

The last-route restore (`app/src/app/page.tsx`) waits for `store.canShowApp`
(mail access + Worker URL) before restoring.

## Files

| File | Role |
|------|------|
| `app/src/lib/desktop/app-session/` | MobX store, phases, provider, 401 listeners |
| `app/src/lib/desktop/app-session/store.test.ts` | Transition tests (injected Tauri mock) |
| `app/src/console/components/setup/ConsoleGateView.tsx` | Owner console Touch ID + passtoken gate |
| `app/src/console/components/setup/ConsoleRouteGate.tsx` | Blocks dashboard until console access |
| `app/src/lib/desktop/biometry/dismiss.ts` | Touch ID dismiss / system-cancel detection |
| `app/src/lib/desktop/shell/AppProviders.tsx` | Root `DesktopProvider` + `AppSessionProvider` |
| `app/src/app/_shell/DesktopDashboardGate.tsx` | Phase `switch` gate |
| `app/src/console/components/setup/UnlockView.tsx` | Owner/invited secret-form unlock |
| `app/src/console/components/setup/WorkerUrlPicker.tsx` | Worker URL select + enter-URL dialog |
| `app/src/console/components/setup/TeamLoginView.tsx` | Invited login form |
| `desktop/src-tauri/src/owner_session.rs` | Dual refresh keyring + split memory |
| `desktop/src-tauri/src/team_session.rs` | Team keyring (no biometry) |

## Adding to the machine

1. Add the new `kind` to `AppSessionPhase` and the `role` derivation.
2. Add a transition in `reconcileFromStatuses`, `bootFromKeyring`, or a store
   action — never mutate `phase` from a view.
3. Add a `case` to the gate `switch` and a view that only renders.
4. If it ships in the Worker, rebuild the bundle (see `AGENTS.md` → *Worker
   bundle*).
5. Add a transition test in `app/src/lib/desktop/app-session/store.test.ts`.
