# Full-screen app loading

**Audience:** humans and coding agents adding a full-viewport wait / handoff screen (boot, last-route restore, trampoline redirects).

**Source of truth:** `app/src/components/AppLoadingScreen.tsx`

---

## Why one screen

Boot (`BootScreen` via `SessionPhaseScreen`) and `/` last-route restore (`RestoreLastRoute`) run back-to-back. If they use different chrome — icon + spinner vs centered "Loading…" text — the window flickers between two layouts.

Always use **`AppLoadingScreen`** (app icon + spinner, no label). Do not invent a second full-screen spinner or a one-off "Loading…" / "Opening…" block.

---

## When to use

Any time the window would otherwise be a blank page or a different wait label while the session, Worker, or last route is still settling.

```tsx
import { AppLoadingScreen } from "@/components/AppLoadingScreen";

return <AppLoadingScreen />;
```

`BootScreen` (`app/src/console/components/setup/BootScreen.tsx`) is a thin alias for the session phase machine. Prefer importing `AppLoadingScreen` for new gates.

Current callers:

| Surface | File |
|---------|------|
| Session boot / not-yet-ready phases | `BootScreen` → `SessionPhaseScreen` |
| `/` last-email-path restore | `RestoreLastRoute` |

---

## When not to use

| Case | Use instead |
|------|-------------|
| In-page overlay on existing chrome | `PageLoadingOverlay` |
| Button / toolbar busy | Inline `Loader2` |
| Screens that already have their own chrome (Unlock, Team login, setup progress) | Keep that chrome; do not swap the whole window to `AppLoadingScreen` |
