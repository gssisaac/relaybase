# Last Route Restore (Email / Dashboard)

**Audience:** humans and coding agents changing app entry redirects, sidebar mode switching, or navigation persistence.

**Source of truth:** `app/src/lib/navigation/sidebar-mode.ts`

---

## Purpose

Relaybase remembers the user’s last **sidebar mode** (`email` | `dashboard`) and the last URL within each mode, then restores that location when they re-enter the app.

Without entry restore, every open hard-redirected to `/dashboard`, which also overwrote the stored mode once `UserSidebar` mounted.

---

## Storage

**Desktop source of truth:** `~/.relaybase/mail/desktop/ui/sidebar.json`  
(WebKit / Application Support `localStorage` is only a mirror — do not rely on it across binary renames.)  
Full home-dir contract: [relaybase-home-storage.md](./relaybase-home-storage.md).

Browser / mirror keys (scoped by fixed local operator id `"desktop"`):

| Key pattern | Value |
|-------------|--------|
| `relaybase:sidebar:mode:{userId}` | `"email"` \| `"dashboard"` |
| `relaybase:sidebar:lastPath:email:{userId}` | Full path including query (e.g. `/email/inbox?account=…&m=…`) |
| `relaybase:sidebar:lastPath:dashboard:{userId}` | Full path including query (e.g. `/accounts?email=…`) |
| `relaybase:sidebar-collapsed:{userId}` | `"1"` / `"0"` |

Defaults when nothing is stored:

- Email: `/email/inbox`
- Dashboard: `/dashboard`

---

## API

| Function | Role |
|----------|------|
| `modeFromPathname(pathname)` | Derive mode from URL (`/email…` → email, else dashboard) |
| `readSidebarMode` / `writeSidebarMode` | Persist active mode |
| `readLastPath` / `writeLastPath` | Persist per-mode path (validated) |
| `isRestorablePath(path, mode)` | Reject `/`, auth/setup/api, and cross-mode paths |
| `resolveEntryPath(userId)` | Mode + last path for app entry (after hydrate) |
| `resolveEntryPathAsync(userId)` | Hydrate from `~/.relaybase` then resolve |
| `hydrateSidebarState(userId)` | Disk ↔ localStorage migrate/hydrate |

Only restorable paths are written or returned. Blocked prefixes: `/login`, `/register`, `/setup`, `/api`.

---

## Who writes

`UserSidebar` updates mode and last path whenever `pathname` / search params change:

```text
app/src/components/layout/UserSidebar.tsx
```

---

## Who restores on entry

| Entry point | Behavior |
|-------------|----------|
| `/` (`app/src/app/page.tsx`) | `<RestoreLastRoute userId="desktop" />` — after `canShowApp`, restores last path; **dashboard** paths call `ensureConsoleAccess()` before navigate |
| `/email` (`app/src/app/(shell)/email/page.tsx`) | redirect → `/email/inbox` |

Client gate:

```text
app/src/components/RestoreLastRoute.tsx
```

`RestoreLastRoute` resolves `userId` as: prop → `fallbackUserId` (`"desktop"`). Cookie login is removed.

Packaged Tauri only pre-renders section roots (`/email/inbox`, `/accounts`, …). Deep selection uses query params (`?m=`, `?email=` / `?tab=`). `normalizeEntryPath` rewrites legacy path segments into those query forms before restore.

---

## Flow

```mermaid
flowchart TD
  entry["/ entry"] --> ready["canShowApp mail + Worker URL"]
  ready --> restore["RestoreLastRoute"]
  restore --> hydrate["hydrateSidebarState desktop"]
  hydrate --> resolve["resolveEntryPath"]
  resolve --> dash{dashboard path?}
  dash -->|yes| gate["ensureConsoleAccess"]
  dash -->|no| navigate["router.replace"]
  gate --> navigate
```
