> **ARCHIVED** — 2026-08-27 launch Touch ID race (fixed by console-only gate).
> See [README](./README.md).

# Desktop unlock — launch Touch ID (2026-08-27)

**Status: fixed in the session machine.** Daily launch must show `UnlockView`
(fingerprint) first. The passtoken form is a user fallback only.

## Expected

Window opens → `UnlockView` (fingerprint). If a keyring secret exists, macOS
Touch ID / Windows Hello follows immediately. Passtoken is behind
"Sign in with passtoken".

## What was wrong

`AppSessionStore.reconcileFromStatuses` mapped `workerUrl && !hasRefresh` to
`unlock { mode: "secret" }`. Boot often hydrated `hasRefresh: false` even when
a keyring session existed:

- `DesktopContext` is already `ready` from the session cache (`credentials.workerUrl`).
- `desktopOwnerSessionStatus()` returns a fake empty status when Tauri invoke
  is not ready yet (`!isDesktopRuntime()`, no throw).
- Owner + team status were `Promise.all`'d; a single failure wrote `EMPTY_OWNER`
  and never retried.

Back on the secret form called `requestPrompt()`, which stayed on `secret`
when `hasRefresh` was false — so Back did nothing. Recover Back went to
`/setup/connect` (which bounces to `/`) while the phase was still
`ownerRecover`, so `SessionPhaseScreen` sent the window back to recover-admin
and the CF OAuth unlisten crashed.

## Fix

- Worker URL + no keyring → `unlock { mode: "idle" }` (`UnlockView`), not secret.
- `AppSessionProvider` waits for the desktop runtime, retries keyring reads,
  and re-fetches when `desktop.isDesktop` flips true.
- `requestPrompt()` always leaves the secret form (idle, or Touch ID if a
  secret exists).
- Recover Back calls `leaveRecover()` and `replace("/")`.
- `listenCfOAuthResult` cleanup ignores an already-removed listener.

See [desktop-session-machine.md](./desktop-session-machine.md).
