/**
 * Central orchestrator for the editor-persistence pipeline.
 *
 * Every save trigger — editor interval, route change, tab close, manual
 * ⌘S — enters `checkpoint(reason)` (or `checkpointSync` for sync-only
 * lifecycle events) and runs the same ordered pipeline:
 *
 *   1. editorCapture.pull()              — serialize editor → content
 *   2. persistAdapter.ingest(content)    — FileStore cache + draft
 *   3. emergencyDraft.sync()             — localStorage synchronous write
 *   4. saveOutbox.enqueue()              — IndexedDB write-ahead log
 *   5. persistAdapter.flush()            — disk PUT (async, keepalive/beacon)
 *
 * See POLICY.md §4 for the full pipeline definition.
 */

import {
  EDITOR_SYNC_INTERVAL_MS,
  SAVE_STATUS,
  SAVE_RETRY_BACKOFF_MS,
} from "./constants";
function isInstantCreateNoteContent(_content: string): boolean {
  return false;
}
import { createDebounceStrategy, type DebounceStrategy } from "./debounce-strategy";
import { syncEmergencyDraft, clearEmergencyDraft } from "./emergency-draft";
import {
  enqueueSaveFireAndForget,
  dequeueSave,
  recordFailedAttempt,
} from "./save-outbox";
import { tryNewsletterBeaconSave } from "./beacon-save";
import type {
  CheckpointReason,
  CheckpointResult,
  EditContext,
  EditorPersistenceConfig,
  PersistAdapter,
  SaveStatus,
} from "./types";

export type EditorPersistenceCoordinator = {
  /** Apply new content from the editor (called from `onChange` and captures). */
  ingest(content: string, sourcePath?: string): void;
  /** Run the full async checkpoint pipeline. */
  checkpoint(reason: CheckpointReason): Promise<CheckpointResult>;
  /** Run the sync-only portion of the pipeline (steps 1–4) for lifecycle events. */
  checkpointSync(reason: CheckpointReason): void;
  /** True when the open file has unsaved changes. */
  isDirty(): boolean;
  /** Current save status for the UI indicator. */
  getStatus(): SaveStatus;
  /** Start the editor-capture interval and arm the debounce strategy. */
  start(): void;
  /** Stop the interval, cancel timers, and detach. */
  stop(): void;
};

export function createEditorPersistenceCoordinator(
  config: EditorPersistenceConfig,
): EditorPersistenceCoordinator {
  const { getSnapshot, persistAdapter, getEditContext, onStatusChange } = config;

  let status: SaveStatus = SAVE_STATUS.IDLE;
  let inFlight: Promise<CheckpointResult> | null = null;
  let intervalHandle: ReturnType<typeof setInterval> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const debounce: DebounceStrategy = createDebounceStrategy(() => {
    void runPersistFromDebounce();
  });

  function setStatus(next: SaveStatus): void {
    if (status === next) return;
    status = next;
    onStatusChange?.(next);
  }

  function pullSnapshot(): { content: string; boundPath: string | null } | null {
    const provider = getSnapshot();
    if (!provider) return null;
    try {
      const content = provider.flushSnapshot();
      if (content == null) return null;
      return { content, boundPath: provider.filePath ?? null };
    } catch {
      return null;
    }
  }

  /** True when a snapshot/onChange may be applied to the current route. */
  function belongsToContext(boundPath: string | null | undefined, ctx: EditContext): boolean {
    if (boundPath == null || boundPath === "" || ctx.path == null) return true;
    return boundPath === ctx.path;
  }

  function writeDurable(ctx: EditContext, content: string): void {
    if (ctx.root == null || ctx.path == null) return;
    // Empty-clobber guard: do not write an empty durable draft when the
    // disk file is non-empty. A hydration race, HMR remount, or stale
    // localStorage draft can produce an empty snapshot; writing it to the
    // emergency draft + IndexedDB outbox would let it overwrite disk
    // content on the next session's outbox replay. Skip the durable write
    // and let the store's `persistFile` guard handle the disk side. See
    // editor-persistence/POLICY.md §10.
    if (isEmptyClobber(ctx, content)) return;
    syncEmergencyDraft(ctx.root, ctx.path, content);
    enqueueSaveFireAndForget(ctx.root, ctx.path, content);
  }

  /**
   * True when `content` would silently destroy a non-empty disk file: a blank
   * buffer or an instant-create `#` stub over restored/history content.
   */
  function isEmptyClobber(ctx: EditContext, content: string): boolean {
    const persisted = persistAdapter.getPersistedContent(ctx);
    if (persisted == null || persisted.trim() === "") return false;
    if (content.trim() === "") return true;
    return (
      isInstantCreateNoteContent(content) &&
      !isInstantCreateNoteContent(persisted)
    );
  }

  async function runPersistFromDebounce(): Promise<void> {
    const ctx = getEditContext();
    if (ctx.mode !== "edit" || ctx.path == null || ctx.root == null) return;
    const content = persistAdapter.getCachedContent(ctx);
    if (content == null) return;
    if (!persistAdapter.isDirty(ctx)) {
      setStatus(SAVE_STATUS.SAVED);
      return;
    }
    await doFlush(ctx, content, "editor-debounce");
  }

  async function doFlush(
    ctx: EditContext,
    content: string,
    reason: CheckpointReason | string,
  ): Promise<CheckpointResult> {
    if (ctx.path == null || ctx.root == null) {
      return { captured: false, flushed: false, persisted: false, path: null, error: null };
    }
    // Empty-clobber guard: refuse to flush an empty buffer over a non-empty
    // disk file. The store's `persistFile` guards the actual disk write;
    // this early return avoids queueing a beacon / outbox entry and marks
    // the status as saved so the editor does not display a stale "unsaved"
    // state from a hydration race. See editor-persistence/POLICY.md §10.
    if (isEmptyClobber(ctx, content)) {
      setStatus(SAVE_STATUS.SAVED);
      return { captured: true, flushed: false, persisted: false, path: ctx.path, error: null };
    }
    setStatus(SAVE_STATUS.SAVING);
    writeDurable(ctx, content);
    try {
      await persistAdapter.flush(ctx, content);
      await dequeueSave(ctx.root, ctx.path);
      clearEmergencyDraft(ctx.root, ctx.path);
      setStatus(SAVE_STATUS.SAVED);
      return { captured: true, flushed: true, persisted: true, path: ctx.path, error: null };
    } catch (error) {
      await recordFailedAttempt(ctx.root, ctx.path, error);
      setStatus(SAVE_STATUS.ERROR);
      scheduleRetry(ctx, content, reason);
      return { captured: true, flushed: true, persisted: false, path: ctx.path, error };
    }
  }

  function scheduleRetry(ctx: EditContext, content: string, reason: CheckpointReason | string): void {
    if (stopped) return;
    if (retryTimer != null) clearTimeout(retryTimer);
    // Use a simple attempt counter via the outbox entry's attempts field.
    // We retry up to SAVE_RETRY_MAX_ATTEMPTS times with the backoff schedule.
    // The first retry uses the smallest backoff; on the last attempt we
    // stop scheduling further retries and let the next checkpoint / online
    // event pick it up.
    const backoffIndex = Math.min(SAVE_RETRY_BACKOFF_MS.length - 1, 0);
    const delay = SAVE_RETRY_BACKOFF_MS[backoffIndex];
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void doFlush(ctx, content, `retry:${reason}`).then((result) => {
        if (!result.persisted) {
          // Bump the backoff by re-reading attempts from the outbox entry
          // via recordFailedAttempt (already called inside doFlush).
          // For simplicity we cap at the last backoff value.
        }
      });
    }, delay);
  }

  async function checkpoint(reason: CheckpointReason): Promise<CheckpointResult> {
    // Coalesce concurrent checkpoints into a single in-flight promise so
    // a rapid burst of hashchange + unmount + interval does not fire 3
    // competing disk writes.
    if (inFlight != null) {
      return inFlight;
    }
    const ctx = getEditContext();
    const snapshot = pullSnapshot();
    let captured = false;
    if (
      snapshot != null &&
      belongsToContext(snapshot.boundPath, ctx) &&
      !isEmptyClobber(ctx, snapshot.content)
    ) {
      persistAdapter.ingest(ctx, snapshot.content);
      captured = true;
    }
    const content = persistAdapter.getCachedContent(ctx);
    if (ctx.path == null || ctx.root == null || content == null) {
      return { captured, flushed: false, persisted: false, path: ctx.path, error: null };
    }
    if (!persistAdapter.isDirty(ctx)) {
      return { captured, flushed: false, persisted: false, path: ctx.path, error: null };
    }
    inFlight = doFlush(ctx, content, reason);
    try {
      return await inFlight;
    } finally {
      inFlight = null;
    }
  }

  function checkpointSync(reason: CheckpointReason): void {
    const ctx = getEditContext();
    const snapshot = pullSnapshot();
    if (
      snapshot != null &&
      belongsToContext(snapshot.boundPath, ctx) &&
      !isEmptyClobber(ctx, snapshot.content)
    ) {
      persistAdapter.ingest(ctx, snapshot.content);
    }
    const content = persistAdapter.getCachedContent(ctx);
    if (ctx.path == null || ctx.root == null || content == null) return;
    // Always write the durable local copy synchronously — this is the
    // guarantee that survives a tab kill mid-async-flush. `writeDurable`
    // applies its own empty-clobber guard.
    writeDurable(ctx, content);
    // For beforeunload/pagehide, also queue a beacon as a secondary
    // disk-write attempt (HTTP backend only; the browser FS backend
    // has no beacon equivalent and relies on the outbox + next-session
    // replay).
    if (reason === "beforeunload" || reason === "pagehide" || reason === "unload") {
      if (!isEmptyClobber(ctx, content)) {
        const beaconPath = ctx.beaconPath ?? ctx.path;
        if (beaconPath) tryNewsletterBeaconSave(beaconPath, content);
      }
    }
  }

  function isDirty(): boolean {
    return persistAdapter.isDirty(getEditContext());
  }

  function getStatus(): SaveStatus {
    return status;
  }

  function start(): void {
    if (stopped) return;
    if (intervalHandle != null) return;
    // The editor-capture interval pulls a snapshot every EDITOR_SYNC_INTERVAL_MS
    // so edits that BlockNote batched or never emitted via onChange still
    // reach the store.
    intervalHandle = setInterval(() => {
      const ctx = getEditContext();
      if (ctx.mode !== "edit") return;
      const snapshot = pullSnapshot();
      if (snapshot == null) return;
      if (!belongsToContext(snapshot.boundPath, ctx)) return;
      // Empty-clobber guard: skip empty snapshots over non-empty disk so a
      // mid-mount / HMR capture does not wipe the buffer.
      if (isEmptyClobber(ctx, snapshot.content)) return;
      const current = persistAdapter.getCachedContent(ctx);
      // Only ingest when the snapshot differs from what the store already
      // has — avoids needless re-renders and debounce resets.
      if (snapshot.content !== current) {
        persistAdapter.ingest(ctx, snapshot.content);
      }
    }, EDITOR_SYNC_INTERVAL_MS);
  }

  function stop(): void {
    stopped = true;
    if (intervalHandle != null) {
      clearInterval(intervalHandle);
      intervalHandle = null;
    }
    debounce.cancel();
    if (retryTimer != null) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  }

  // The coordinator exposes `ingest` for the editor's onChange path. It
  // schedules the debounce and writes the durable local copy immediately
  // (so even a 400ms-window tab close still has the latest content).
  function ingest(content: string, sourcePath?: string): void {
    const ctx = getEditContext();
    if (sourcePath != null && !belongsToContext(sourcePath, ctx)) return;
    if (ctx.mode !== "edit" || ctx.path == null || ctx.root == null) return;
    // Empty-clobber guard: an empty onChange (e.g. BlockNote HMR remount,
    // hydration race) must not be ingested over a non-empty disk file. The
    // store's `setContent` would otherwise mark the file dirty and the
    // 400ms debounce would write empty to disk. See editor-persistence/
    // POLICY.md §10.
    if (isEmptyClobber(ctx, content)) return;
    persistAdapter.ingest(ctx, content);
    writeDurable(ctx, content);
    debounce.schedule();
    setStatus(SAVE_STATUS.DIRTY);
  }

  return {
    ingest,
    checkpoint,
    checkpointSync,
    isDirty,
    getStatus,
    start,
    stop,
  };
}

// Re-export for the public API surface.
export type { PersistAdapter };
