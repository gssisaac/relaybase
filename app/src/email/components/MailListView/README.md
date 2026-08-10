# MailListView

Inbox / Drafts / Sent / Trash list + detail UI. **Public entry point:** `@/email/components/MailListView` (single file export — do not import panes/hooks from routes).

## Role

`MailListView` is a **thin orchestrator** (~200 lines). It wires hooks and renders two panes. It does not contain list derivation, keyboard policy, or detail branching logic.

| Concern | Owner |
|---------|--------|
| Pure formatting / href helpers | `mail-list-helpers.ts` |
| Store → list model (`items`, `selected`, threads) | `useMailListItems.ts` |
| Bubble-phase shortcuts (`j`/`k`/`Esc`/`c`/`r`/`a`/`f`) | `useMailListKeyboard.ts` |
| Inline thread reply/forward panel state | `useThreadComposeState.ts` |
| Standalone compose open/resume/new | `compose-open.ts` |
| Cmd+K + row context menu runtime | `useEmailCommandRuntimeAdapter.ts` |
| List toolbar + rows + empty state | `MailListPane.tsx` |
| Draft / thread / single-message detail | `MailDetailPane.tsx` |

## Architecture

```mermaid
flowchart TB
  MLV[MailListView orchestrator]
  Helpers[mail-list-helpers.ts]
  Items[useMailListItems]
  Kb[useMailListKeyboard]
  Compose[useThreadComposeState]
  Open[compose-open]
  Commands[useEmailCommandRuntimeAdapter]
  ListPane[MailListPane]
  DetailPane[MailDetailPane]
  MLV --> Items
  MLV --> Kb
  MLV --> Compose
  MLV --> Open
  MLV --> Commands
  MLV --> ListPane
  MLV --> DetailPane
  Items --> Helpers
  Kb --> Helpers
  ListPane --> Helpers
  DetailPane --> Helpers
```

## File map

```text
app/src/email/components/
  MailListView.tsx              # orchestrator (this folder's parent file)
  MailListView/README.md        # this document
  mail-list-helpers.ts          # formatDate, messageHref, previewText, …
  useMailListItems.ts           # threads, items, selected, detail loading
  useMailListKeyboard.ts        # window keydown layer
  MailListPane.tsx              # list column UI
  MailDetailPane.tsx            # detail column UI
  useThreadComposeState.ts      # inline compose on open thread (related)
```

## Data flow

1. **Props:** `folder` (`inbox` | `drafts` | `sent` | `trash`) + optional `messageId` from the route.
2. **`useMailListItems`** reads the MobX mailbox store and returns `items`, `selected`, `selectedThread`, `listHref`, etc. Search string is owned by the orchestrator and passed in.
3. **`useThreadComposeState`** manages inline reply/forward when a thread is open (`?reply=` URL params are consumed here).
4. **`useEmailCommandRuntimeAdapter`** builds per-row command runtimes for context menu + palette scope.
5. **`useMailListKeyboard`** registers bubble-phase hotkeys (skipped when Cmd+K palette is open or focus is in an input).
6. **Panes** are presentational: props in, JSX out. No direct store reads in panes.

## Keyboard layers

See [docs/email-command-system.md](../../../../docs/email-command-system.md) for full rules.

| Key | Behavior |
|-----|----------|
| `j` / `↓` | Next row |
| `k` / `↑` | Previous row |
| `Esc` / `u` | Close inline compose, else back to list |
| `c` | Resume latest standalone compose draft |
| `⇧C` | New standalone compose (`?new=1`) |
| `r` / `a` / `f` | On open inbox thread: resume matching inline draft; else run command |
| `e` / `Backspace` / `Delete` | Trash (or restore in trash folder) |

Compose open policy (resume vs new, UI vs keyboard) lives in **`compose-open.ts`**, not here.

## Split-pane layout

- No `messageId`: list fills the view.
- With `messageId`: list column narrows on `md+`; detail column shows on the right (mobile hides list when detail is open).

## Adding features

| Change | Where to edit |
|--------|----------------|
| New list column / row badge | `MailListPane.tsx` |
| New detail view for a message kind | `MailDetailPane.tsx` |
| New shortcut | `useMailListKeyboard.ts` + [email-command-system.md](../../../../docs/email-command-system.md) |
| New mail command (Cmd+K / context menu) | `app/src/email/commands/` — not MailListView |
| Thread grouping / selection logic | `useMailListItems.ts` |
| Compose open/resume policy | `compose-open.ts` |

**Do not** re-grow `MailListView.tsx` with business logic. Add a hook or pane module instead.

## Verification checklist

- [ ] Inbox thread select + `j`/`k` navigation
- [ ] `c` resume compose, `⇧C` force new
- [ ] `r`/`a`/`f` resume on thread; UI Reply always new draft
- [ ] Draft detail edit + discard (`Esc`)
- [ ] Trash restore / empty trash
- [ ] Cmd+K + row context menu
- [ ] `pnpm exec tsc --noEmit` (from `app/`)
