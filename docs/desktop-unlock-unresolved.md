# Desktop unlock — unresolved (2026-08-27)

**Status: not fixed.** Daily launch still does not show Touch ID first.

## Expected

Window opens → macOS Touch ID (or Windows Hello) immediately. Passtoken is a fallback only.

## Actual (verified)

1. `desktop/ pnpm dev` compiled after the session-machine work, then the window stayed on **Loading…**.
2. After the `/` + MobX subscription patch, the first screen is the **passtoken form** (username + passtoken). No Touch ID dialog.

## Why the machine still loses

`AppSessionStore.reconcileFromStatuses` maps `workerUrl && !hasRefresh` to `unlock { mode: "secret" }`. Boot often hydrates `hasRefresh: false` even when a keyring session exists:

- `DesktopContext` is already `ready` from the session cache (`credentials.workerUrl`).
- `desktopOwnerSessionStatus()` returns a fake empty status when Tauri invoke is not ready yet (no throw).
- Owner + team status are `Promise.all`'d; a team failure + `catch` writes `EMPTY_OWNER` and never retries.

`/` is outside `(shell)`, so the gate never ran on entry. `SessionPhaseScreen` + `useAppSession` reaction were added so the window can leave Loading — they did **not** restore Touch ID first.

Do not treat this area as done. Next fix: wait for a real keyring read, default daily unlock to `prompting` + `authenticateBiometry`, and open the passtoken form only as a user fallback.

See [desktop-session-machine.md](./desktop-session-machine.md).
