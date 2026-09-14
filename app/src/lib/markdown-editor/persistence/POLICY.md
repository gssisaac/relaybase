# Editor Persistence Policy

This document is the **single source of truth** for how the markdown / yaml editor
persists edits in Railmark. All persistence logic lives in
`app/src/lib/editor-persistence/`. Consumers (`App.tsx`, `MarkdownEditor.tsx`,
`FileStore`, navigation components) only call the public API exported from
`index.ts` — they must not implement save logic themselves.

## 1. Why this module exists

Previous behavior lost edits in near 100% of "leave the page" scenarios because
save depended on a single fragile chain:

```
BlockNote.onChange  →  FileStore.setContent  →  400ms debounce  →  PUT /api/file
```

Every link could break independently:

- BlockNote batches / IME / unmount can swallow `onChange` — Store never hears the edit.
- `clearSaveOnPathChange()` cancelled the debounce timer without flushing on route change.
- `navigateSettings` / `history.back()` bypassed `goTo()` — no flush.
- `pagehide` used `void flushSave()` — async write killed mid-flight on tab close.
- No max-wait debounce — 1 hour of continuous typing with no 400ms pause = 0 disk writes.

This module replaces that chain with a **defense-in-depth pipeline** so any single
failure still leaves a durable, recoverable copy.

## 1.0 Layer 0 — Server-side safety backup (MS Word "Backup copy")

Layer 0 is **server-side and client-independent**. It is the only layer
that can prevent a *total* wipeout regardless of client bugs, races,
beacon, HMR remounts, agent `file_edit`, or external fs writes. The
five layers in §2 below protect **editor → disk**; they cannot prevent
an empty buffer or an external write from destroying disk content
because they are all client-driven and debounced. Layer 0 closes that
gap by rotating the *current* on-disk content into a hidden sibling
**before** every destructive write.

**Mechanism (MS Word "Always create backup copy"):** before every
write to `{root}/{path}`, the server reads the existing file and, if it
is non-empty and differs from the incoming content, writes the previous
content to a hidden sibling `.{filename}/.backup.md` in the **same folder**
(`filename` is the stem; the folder is dot-prefixed → hidden; the doc
tree skips dotfiles so it never clutters the UI). The `.backup.md` always
holds the previous version and is overwritten on each save (rotate-keep),
never deleted.

**Empty-clobber guard (the core safety net):** when the existing on-disk
content is empty/whitespace, the `.backup` is **not** overwritten — the
last non-empty version is preserved. So an accidental empty save leaves
the prior good version recoverable, even after repeated empty saves:

```
file="A", .backup=∅      → save "B": .backup="A",  file="B"
file="B", .backup="A"     → save "" : .backup="B" (NOT overwritten with ""), file=""   ← recoverable
file="", .backup="B"     → save "" : .backup="B" (preserved),            file=""   ← still recoverable
```

**Delete:** deleting the real file does **not** delete the `.backup`
(accidental delete is recoverable). The `.backup` is rotated on the
next successful save of that path.

**Where it lives:** `app/src/plugins/backups/safety-backup-store.ts`
(`rotateBeforeWrite`, `readSafetyBackup`, `restoreSafetyBackup`,
`findWipedFilesWithSafetyBackups`) and `desktop/src-tauri/src/safety_backup.rs`.
Wired into every destructive write path:

| Path | Handler |
|------|---------|
| `PUT /api/file` | `vite-docs-fs-plugin.ts` → `rotateBeforeWrite` |
| `POST /api/file/beacon` | `vite-docs-fs-plugin.ts` → `rotateBeforeWrite` |
| Tauri `vault_write_file` | `vault.rs` → `safety_backup::rotate_before_write` |
| Browser `browserSaveFile` | `runtime/browser/fs.ts` → `browserRotateBeforeWrite` (File System Access) |

**Recovery API:** `GET /api/safety-backup`, `POST /api/safety-backup/restore`
(Vite); `vault_read_safety_backup`, `vault_restore_safety_backup` (Tauri);
`fetchSafetyBackup` / `restoreSafetyBackup` (`lib/http/safety-backup-http.ts`,
unified via `lib/api.ts`).

**Recovery UX:** `SafetyBackupBanner` surfaces a wipe immediately when
the open file's content is empty and a non-empty `.backup` exists;
`StartupWipeBanner` runs `findWipedFilesWithSafetyBackups()` at startup
across recently opened files (`lib/recent-files.ts`) and offers a
non-disruptive "Review" prompt; `FileHistoryPanel` shows a "Safety
backup" row for manual restore.

**Relationship to history (§4):** Layer 0 is a different concept from
history. History (`{vault}/.railmark/backups/`, 100 snapshots,
client-driven 45s/120s debounce) is for *browsing past versions*.
Layer 0 (one `.{filename}/.backup.md` per file, server-side, synchronous with
write) is for *disaster recovery*. History cannot prevent a total
wipeout because a wipe that lands inside the debounce window leaves no
snapshot; Layer 0 always has the immediately-prior version.

## 2. The five layers

| # | Layer | File | Trigger | Survives |
|---|-------|------|---------|----------|
| 1 | Editor Capture | `editor-capture.ts` | 5s interval, unmount, blur, compositionEnd | in-memory + downstream layers |
| 2 | Navigation Checkpoint | `navigation-guard.ts` + `lifecycle-listeners.ts` (hashchange/popstate) | goTo, settings, history, route change | disk + draft |
| 3 | Store Durability | `coordinator.ts` + `debounce-strategy.ts` + `persist-adapter.ts` | every ingest, 400ms debounce, 30s max-wait | memory cache + localStorage draft + disk |
| 4 | Browser Survival | `lifecycle-listeners.ts` + `emergency-draft.ts` + `save-outbox.ts` + `beacon-save.ts` | beforeunload, pagehide, visibilitychange, freeze | localStorage + IndexedDB outbox |
| 5 | Recovery | `recovery.ts` | app startup, vault reconnect, online event | disk via replay |

## 3. Lifecycle event subscription (critical)

`lifecycle-listeners.ts` is registered **once** by `useEditorPersistence` on app
mount and unregistered on unmount. **No other code may call
`window.addEventListener("beforeunload", ...)` for save purposes.**

| Event | target | When | Module action | sync/async |
|-------|--------|------|--------------|-----------|
| `hashchange` | `window` | URL hash changes (`#/workspace/a` → `#/settings`) | `checkpoint("route-hashchange")` — editor pull → draft sync → flush attempt | async flush + **sync draft** |
| `popstate` | `window` | browser back / forward | `checkpoint("route-popstate")` — leaving file flush | async + sync draft |
| `beforeunload` | `window` | tab/window close, refresh, external nav | `checkpointSync("beforeunload")` — syncEmergencyDraft + sendBeacon. Do **not** `preventDefault` (no native "Reload site?" prompt) — drafts + outbox survive reload and `recovery.ts` replays automatically | **sync first** |
| `pagehide` | `window` | bfcache entry, tab close (`persisted=false`) | sync draft + outbox + keepalive/beacon | sync draft, async disk |
| `visibilitychange` | `document` | hidden (tab switch, minimize) | `checkpoint("visibility-hidden")` — editor pull + flush | async |
| `freeze` | `document` | Chrome bfcache freeze (when supported) | `checkpointSync("freeze")` — sync draft only | sync |
| `unload` | `window` | legacy fallback (some browsers) | `checkpointSync("unload")` — sync draft only (no async) | sync only |

`hashchange` and `popstate` run **in parallel** with `router.ts`'s
`subscribeRoute`. The router updates UI state; this module runs the save
checkpoint — separation of concerns. `useRouter`'s `onRouteChange` callback
additionally calls `checkpoint("route-react")` as a second safety net.

## 4. Checkpoint pipeline (single entry point)

Every save trigger — whether from a 5s interval, a route change, or tab close —
enters `coordinator.checkpoint(reason)` (or `checkpointSync` for sync-only events)
and runs the same ordered steps:

```
1. editorCapture.pull()              — BlockNote state → content string
2. persistAdapter.ingest(content)    — FileStore.setContent (cache + draft)
3. emergencyDraft.sync()             — localStorage synchronous write (always)
4. saveOutbox.enqueue()              — IndexedDB (sync transaction when possible)
5. persistAdapter.flush()            — disk PUT (async, keepalive/beacon)
```

`checkpointSync` performs steps 1–4 synchronously and skips the async disk flush
(beacon may still be queued). This guarantees that even if the tab is killed
mid-flush, a durable local copy exists.

Reload / tab close must **not** show the browser's native leave confirmation.
A durable local copy is already written before the document unloads, so a
reload is safe: the next session replays the outbox and restores drafts.

File-history snapshots (FileStore backups / FileHistoryPanel) are **not**
part of this pipeline. They use their own trailing + max-wait debounce
(`HISTORY_BACKUP_DEBOUNCE_MS` / `HISTORY_BACKUP_MAX_WAIT_MS` in `@/lib/config`)
and must not be recorded from every `ingest` or disk flush.

## 5. Debounce policy

| Constant | Value | Purpose |
|----------|-------|---------|
| `AUTOSAVE_DEBOUNCE_MS` | 400 | Trailing debounce after last keystroke |
| `AUTOSAVE_MAX_WAIT_MS` | 30 000 | Force persist even during continuous typing |
| `EDITOR_SYNC_INTERVAL_MS` | 5 000 | Periodic editor → store pull (catches missed onChange) |

`debounce-strategy.ts` implements a trailing + max-wait timer pair. The trailing
timer resets on every `ingest`; the max-wait timer fires once per dirty burst
and forces a flush even if the user keeps typing.

## 6. Failure & recovery policy

- Disk flush failure → outbox entry retained → exponential retry
  (1s, 3s, 10s, 30s, max 5 attempts) via `recovery.ts`.
- `online` event triggers an immediate retry pass.
- `clearOnDisconnect` must **not** delete localStorage drafts — vault disconnect
  only means we lost the file handle, not that the user's edits are invalid.
  Drafts are preserved until the user explicitly clears them.
- On app startup and vault reconnect, `replayPendingSaves(workspacePath)`
  drains **only** outbox rows that belong to the currently open workspace.
  Rows from another folder, or legacy rows with no `workspacePath`, are left
  untouched so a reconnect cannot write `products/…` (or any relative path)
  into the wrong vault.
- `findRecoverableDrafts()` reports drafts newer than disk so the UI can
  prompt "Keep disk / Restore draft". Emergency drafts and recent-files are
  scoped by workspace path; unscoped legacy localStorage values are not
  copied into the first folder that reads them.

## 7. Prohibitions

These are enforced by code review and the module's single-import surface:

- **No** `window.addEventListener("beforeunload" | "pagehide" | "visibilitychange" | "hashchange" | "popstate", ...)` in `App.tsx` or any component for save purposes. Use `useEditorPersistence`.
- **No** `clearSaveOnPathChange()`-style "cancel timer without flush". Use `preparePathChange()` which awaits flush first.
- **No** raw `navigateSettings()` / `history.back()` calls from app code. Use `guardedNavigateSettings` / `guardedHistoryBack` from this module.
- **No** `void fileStore.flushSave()` on tab close. The coordinator's `checkpointSync` handles it.
- **No** `event.preventDefault()` / `returnValue` on `beforeunload` to show a leave/reload prompt. Reload is safe; do not block it.
- **No** recording a file-history snapshot from persist / `flushSave` / coordinator ingest. History debounce lives in FileStore and is independent of the 400ms persist window.
- **No** save logic duplicated in `MarkdownEditor.tsx` / `YamlRawEditor.tsx`. They only expose `flushSnapshot()` via ref. Markdown WYSIWYG ↔ raw source is a `sourceView` swap, not a new `Mode`; both stay `edit` and share this pipeline. A source-view change must `checkpoint("source-view-change")` before unmounting the leaving editor.
- **No** server-side destructive write path that bypasses the safety-backup rotation. `PUT /api/file`, `POST /api/file/beacon`, and Tauri `vault_write_file` must all funnel through `rotateBeforeWrite` / `safety_backup::rotate_before_write` so the prior version is preserved in `.{filename}/.backup.md` before the overwrite. A direct `fs.writeFile` of a document file is forbidden. See §1.0 (Layer 0).

## 8. Disk ↔ editor clobber guard (critical)

The five layers in §2 protect **editor → disk**. They do **not** protect the
reverse direction: an external write (agent `file_edit`, chokidar, another
tool) that lands while the editor holds the file open. Without the rules
below, a hydration race, HMR remount, or stale localStorage draft can push
an **empty** buffer back to disk and silently destroy content — and
because history only arms on real `setContent` edits, the lost version
leaves no recoverable snapshot.

| Rule | Where enforced |
|------|---------------|
| **An empty/whitespace buffer must never overwrite a non-empty disk file.** `persistFile` rejects the write, restores the buffer to `lastPersistedContent`, and clears the autosave timer. The coordinator's `ingest`, `writeDurable`, `doFlush`, `checkpoint`, `checkpointSync`, and capture interval all skip empty content when the persisted content is non-empty. `mergeDraftIntoEntry` drops an empty draft instead of merging it over non-empty disk content. An explicit `allowEmptyPersist` escape hatch exists for a future intentional "clear file" action; `clearContent()` does not persist. | `file-store.ts`, `coordinator.ts`, `persist-adapter.ts` |
| **The editor does not emit changes before its first hydration completes.** `MarkdownEditor` keeps a `hydratedRef` that is `false` until the first `setEditorMarkdown` finishes. While `false`, `notifyEditorChange` and `flushSnapshot` are no-ops, and the unmount flush is skipped. This stops a BlockNote HMR remount / mid-hydration `onChange` from pushing an empty or stale snapshot into the store. | `MarkdownEditor.tsx` |
| **An editor snapshot must never be applied to a different file.** `hashchange` / unmount can run after the route already points at file B while the leaving editor still holds file A. `EditorSnapshotProvider.filePath` and `ingest(content, sourcePath)` reject that mismatch so A's buffer cannot become B's draft or disk content. | `coordinator.ts`, `MarkdownEditor.tsx`, `YamlRawEditor.tsx` |
| **External writes are recoverable and never drop either side.** `invalidate` snapshots the current buffer to history when it holds real edits (non-empty and differs from `lastPersistedContent`) before merging; when the buffer is empty or matches the persisted content (no real edits — hydration race, HMR remount), it reloads from disk silently instead of merging. `reloadFromDisk` clears the local draft so the draft merge cannot re-apply the discarded edits. `persistFile` captures the load generation before the async write and aborts if a reload changed the buffer. See §9 for the 3-way merge that replaces the old binary Reload/Keep banner. | `file-store.ts` |
| **Path changes flush the leaving file.** `setOpenFile` captures the leaving root/path/content and, after switching the open pointer, flushes the leaving buffer with the explicit root/path so the last 400ms of edits are not lost. This replaces the old "cancel timer without flush" pattern (POLICY §7). The empty-clobber guard and generation check make this safe. | `file-store.ts` |

## 9. Three-way merge on external change (AI + user co-editing)

When an external write (AI agent `file_edit`, chokidar fs event, backup
restore) lands on a file that has unsaved local edits, `FileStore.invalidate`
runs a **3-way merge** instead of the old binary "Reload from disk / Keep my
changes" choice, so neither side is silently dropped.

```
base   = lastPersistedContent   (what was on disk when the user last loaded/saved)
ours   = FileStore.content       (the user's unsaved buffer)
theirs  = newly fetched disk content
```

`attemptMerge` (`file-store.ts`) uses `merge3` from `@/lib/merge/diff3-merge`:

- **Clean merge** (non-overlapping edits, or both sides made the identical
  edit) → the merged text is applied to the buffer and persisted to disk
  silently. No banner.
- **Conflict** (overlapping edits that differ) → the merged text with
  git-style conflict markers is loaded into the buffer and `conflictState`
  is set. Both versions are preserved inline:

  ```
  <<<<<<< ours
  your version
  =======
  the AI / incoming version
  >>>>>>> theirs
  ```

Neither side is lost: the user's edits were snapshotted to history before
the merge (`createBackup("auto", "before external change")`), and any
conflict keeps both versions literally in the file. Closing the file
without resolving leaves the markers on disk, so both versions survive.

### Resolution

- `resolveConflictHunk(index, choice)` rewrites one marker block; choices
  are `ours`, `theirs`, `both-ours-first`, `both-theirs-first`.
- `resolveAllConflicts(choice)` resolves every hunk with the same choice
  (used by the `ConflictBanner` bulk buttons).
- Manual editing also resolves: `setContent` re-counts markers via
  `decodeConflicts` and, when the last marker is gone, clears
  `conflictState` and persists the clean text.
- `reloadFromDisk` is the escape hatch: it discards the merge and force-
  reloads from disk (the user's edits remain recoverable via the pre-merge
  history snapshot).

### Autosave block during conflict

While `conflictState` is set, `setContent` does **not** schedule autosave, so
git-style markers can never be persisted to disk by a background timer. The
buffer is only persisted once all markers are gone (via resolution or manual
editing). `attemptMerge` also clears the pending autosave timer before
fetching `theirs`, so a stale 400ms save cannot fire mid-merge and clobber
the buffer or change the merge base.

### Agent event timing

An agent `file_edit` event can fire before the disk write completes. If the
fetched `theirs` still equals `lastPersistedContent`, `attemptMerge` retries
once after `MERGE_THEIRS_RETRY_MS` (150ms) so the merge runs against the real
incoming content. The chokidar path already waits for write stability
(`awaitWriteFinish` ~120ms).

### UX surfaces

- `ConflictBanner` — hunk count + bulk "Keep all mine / Keep all theirs" +
  "Reload from disk" + dismiss-for-manual-resolve.
- `ConflictResolutionList` — per-hunk cards (Mine / Theirs / Both) decoded
  from the live buffer. v1 renders the raw markers in the editor; a future
  v2 may render a read-only custom BlockNote block instead.
- `YamlRawEditor` — highlights the marker lines in the raw textarea.
- The legacy `ExternalChangeBanner` (binary Reload/Keep) is kept only as a
  fallback for the rare case where `theirs` could not be fetched (disk read
  failed); the merge path is the default for every external change.

## 10. Public API
Only what `index.ts` exports is part of the contract:

```ts
// React integration (App.tsx)
useEditorPersistence({ fileStore, editorRef, modeRef, routeRef })

// Imperative coordinator (tests, non-React callers)
createEditorPersistenceCoordinator(config)

// Navigation helpers — replace raw navigate/navigateSettings/history*
guardedNavigate, guardedNavigateSettings, guardedHistoryBack, guardedHistoryForward

// Recovery (App startup / vault reconnect)
replayPendingSaves(workspacePath), findRecoverableDrafts()

// UI status
SAVE_STATUS
```

## 11. Success criteria

1. BlockNote `onChange` fires 0 times → interval/unmount flush still updates the Store.
2. Every exit path (goTo, settings, history back/forward, mode change, source-view change, tab close) runs a checkpoint.
3. Browser kill → localStorage **and** IndexedDB outbox both populated; next session auto-replays.
4. Continuous typing → disk persist at most every 30s (max-wait).
5. Save failure → automatic retry + visible error state.
6. Reload / tab close never shows a native leave prompt; recovery is automatic.
7. An external write (agent / fs) while the file is open never results in an empty buffer overwriting a non-empty disk file; real local edits are snapshotted to history before a reload.
8. (Layer 0) A `PUT /api/file` with empty content — whether from the editor, a beacon, an agent `file_edit`, or a raw curl — leaves the prior non-empty version recoverable in the same folder's `.{filename}/.backup.md`. Repeated empty saves never destroy the last non-empty `.backup.md`. Deleting the real file preserves the `.backup.md`.
9. When an external write lands on a dirty file, a 3-way merge runs: non-overlapping edits auto-merge silently, and overlapping edits preserve both versions inline as git-style conflict markers — neither the user's nor the AI's edits are dropped. Markers never reach disk (autosave is blocked while `conflictState` is set).

**"Always saved" means:** on any exit path, the checkpoint pipeline runs and a
durable local copy remains, with automatic replay on the next session — zero
user work lost.
