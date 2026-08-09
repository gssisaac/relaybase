# Email Command System

**Audience:** humans and coding agents changing mail actions, shortcuts, Cmd+K, or row context menus.

**Source of truth:** `app/src/email/commands/`

If you add or change an email action (reply, trash, mark read, copy, compose, etc.), read this document first and follow the rules below.

---

## Purpose

Relaybase mail actions must behave like a Superhuman-style command system:

1. **One definition** of each command (label, icon, shortcut, availability).
2. **One execution path** shared by:
   - Cmd+K / Ctrl+K palette
   - Row right-click context menu
   - Mail keyboard shortcuts that map to commands (`c`, `r`, `a`, …)
3. **Selection-filtered lists** — show only commands that apply to the current folder + selected item. Do **not** show disabled gray rows for unavailable actions.
4. **Layered keyboard handling** — app-level ⌘K must not also fire mail-layer `k` (previous message).

Do **not** reintroduce dashboard “Open Dashboard / Open Domains / …” navigation into the mail Cmd+K palette. That palette is mail-command only.

---

## Folder structure

```text
app/src/email/commands/
  email-command-defs.ts           # Static metadata (id, label, icon, shortcut, requires)
  email-command-store.ts          # resolve + run (availability + runners)
  EmailCommandRuntimeContext.tsx  # paletteOpen + published selection scope
  useEmailCommandRuntimeAdapter.ts# Binds mailbox/router into EmailCommandRuntime
  EmailCommandContextMenu.tsx     # Row context menu UI
  GlobalCommandPalette.tsx        # Cmd+K UI (consumes scope.commands)
  index.ts                        # Public barrel — external imports use this
```

Related (outside the module, thin consumers):

| File | Role |
|------|------|
| `app/src/app/(dashboard)/DesktopDashboardGate.tsx` | Mounts `EmailCommandRuntimeProvider` + `GlobalCommandPalette` |
| `app/src/email/components/MailListView.tsx` | List/detail UI; calls adapter; keeps j/k/esc navigation hotkeys |
| `app/src/components/ui/command.tsx` | Generic cmdk primitives |
| `app/src/components/ui/context-menu.tsx` | Generic context-menu primitives |
| `app/src/email/email-mailbox-store.ts` | Data actions (`markRead`, `moveToTrash`, …) |

```mermaid
flowchart TB
  defs[email-command-defs] --> store[email-command-store]
  adapter[useEmailCommandRuntimeAdapter] --> store
  adapter --> ctx[EmailCommandRuntimeContext]
  mailList[MailListView] --> adapter
  mailList --> menu[EmailCommandContextMenu]
  menu --> store
  palette[GlobalCommandPalette] --> ctx
  gate[DesktopDashboardGate] --> ctx
  gate --> palette
```

---

## Data flow

1. **Static defs** declare what a command *is* (`EMAIL_COMMAND_DEFS`).
2. **Adapter** builds an `EmailCommandRuntime` for a target row/selection (hrefs, unread, store callbacks).
3. **`resolveEmailCommands(runtime)`** returns **available-only** commands.
4. Adapter **publishes** `{ title, targetId, targetKind, commands }` into runtime context (`setScope`).
5. **Palette** and **context menu** render that list (or resolve from a row-specific runtime).

Clear scope only on mailbox view unmount. Do not clear-then-set on every selection update (that briefly emptied Cmd+K).

---

## Keyboard layers (mandatory)

| Layer | Where | Behavior |
|-------|--------|----------|
| **App** | `GlobalCommandPalette` | Capture-phase listener for `meta/ctrl + k`. `preventDefault` + `stopImmediatePropagation`. Toggles `paletteOpen`. |
| **Mail** | `MailListView` | Bubble-phase. If `paletteOpen` **or** `meta/ctrl/alt` → return immediately. Then handle `j/k`, arrows, `u/esc`, `e/Delete`, and command keys via `runSelectedCommand`. |

Rules:

- Never handle bare `k` without checking modifiers.
- Never let mail shortcuts run while the palette is open.
- List navigation (`j`/`k`/arrows/`u`/`esc`) stays in the mail view. Command keys that map to defs (`c`/`r`/`a`) go through `runSelectedCommand`.
- Trash `e` / Delete may keep next-item navigation in `MailListView` (view concern, not command metadata).

---

## How to add a new command

Follow this order. Skip nothing.

### 1. Static definition — `email-command-defs.ts`

Add to `EmailCommandId` and `EMAIL_COMMAND_DEFS`:

- `id`, `label`, `group` (`navigation` \| `actions` \| `copy`)
- `keywords` (Cmd+K search)
- `icon` (Lucide)
- `shortcut` when there is a discoverable key (shown in UI)
- `requires` for declarative filtering:
  - `target`: `"any"` \| `"inbox"` \| `"sent"` \| `"draft"`
  - `folders`: e.g. `["inbox"]`
  - `unread`: `true` / `false` for mark read/unread

Use `trashLabel` / `trashIcon` only for folder-dependent presentation (e.g. trash vs restore).

### 2. Runtime availability + runner — `email-command-store.ts`

In the same change:

- Extend `isRuntimeAvailable` (edge cases defs cannot express, e.g. empty subject).
- Extend `buildRunner` to call the right `EmailCommandRuntime` callback.

`resolveEmailCommands` must keep returning **available-only** (filter out, do not return `disabled: true` for the UI to gray out).

### 3. Adapter callbacks — `useEmailCommandRuntimeAdapter.ts`

If the action needs new mailbox/router behavior, add a field on `EmailCommandRuntime` and wire it in the adapter (navigate, store method, clipboard, etc.). Prefer calling existing `EmailMailboxStore` methods over new ad-hoc fetch in the UI.

### 4. Do **not** fork UI lists

- Do not hardcode the new action only in `MailListView` buttons or only in the palette.
- Context menu and Cmd+K must pick it up via `resolveEmailCommands`.
- Detail-pane buttons may call the same store methods for discoverability, but the **command registry** remains the shared contract for palette/menu/shortcuts.

### 5. Public API

External packages/components import from `@/email/commands` (barrel). Do not deep-import internals from outside the module unless necessary inside `commands/` itself.

---

## Rules (do / don’t)

### Do

- Keep static metadata in `email-command-defs.ts` only.
- Keep resolve/run logic in `email-command-store.ts`.
- Keep Cmd+K and context menu as thin consumers.
- Filter by selection; omit unavailable commands.
- Guard mail hotkeys against modifiers and `paletteOpen`.
- Put new command UI pieces under `app/src/email/commands/` and export via `index.ts`.
- Update this doc when you change module boundaries or keyboard-layer contracts.

### Don’t

- Don’t add dashboard/settings “Open …” navigation back into mail Cmd+K.
- Don’t duplicate command labels/shortcuts in three places.
- Don’t show unavailable commands as disabled rows in palette/menu.
- Don’t put `commandRuntimeFor` / scope publish / context-menu rendering back into a growing god-component; use the adapter + `EmailCommandContextMenu`.
- Don’t handle ⌘K only in the bubble phase without capture + `stopImmediatePropagation`.
- Don’t clear command scope on every selection tick (unmount-only clear).

---

## Testing checklist (manual)

After changing commands:

1. Inbox message selected → Cmd+K shows reply / trash / mark / copy (as applicable), not dashboard links.
2. Sent message selected → no reply/reply-all; trash/copy/open still appear when valid.
3. No selection → only global-safe commands (e.g. compose).
4. ⌘K does **not** move selection up (`k`).
5. Palette open → `j`/`k`/`r` do not move mail.
6. Right-click a row → same available set as Cmd+K for that row.
7. Shortcut letters in defs still match mail-layer handlers where intended.

---

## Quick file map for agents

| Task | Touch |
|------|--------|
| New mail action in Cmd+K / menu / shortcut | `email-command-defs.ts` → `email-command-store.ts` → adapter if new runtime callback |
| Change when a command appears | `requires` and/or `isRuntimeAvailable` |
| Change palette chrome only | `GlobalCommandPalette.tsx` |
| Change row menu chrome only | `EmailCommandContextMenu.tsx` |
| Wire provider / mount palette | `DesktopDashboardGate.tsx` |
| List navigation keys only | `MailListView.tsx` (keep command keys via `runSelectedCommand`) |
