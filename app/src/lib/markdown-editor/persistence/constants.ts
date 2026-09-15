/**
 * Timing constants for the editor-persistence module.
 *
 * Values are exported here (not from `@/lib/config`) so the persistence
 * policy is fully self-contained. `@/lib/config` keeps its own
 * `AUTOSAVE_DEBOUNCE_MS` for layout-editor and other legacy consumers;
 * the editor-persistence module reads its own copy.
 */

/** Trailing debounce after the last keystroke before flushing to disk. */
export const AUTOSAVE_DEBOUNCE_MS = 400;

/** Force a disk flush after this many ms even if the user keeps typing. */
export const AUTOSAVE_MAX_WAIT_MS = 30_000;

/** Interval at which the coordinator pulls a snapshot from the editor. */
export const EDITOR_SYNC_INTERVAL_MS = 5_000;

/** Maximum time to wait for an async checkpoint before giving up (ms). */
export const CHECKPOINT_TIMEOUT_MS = 2_000;

/** IndexedDB outbox database / store names. */
export const OUTBOX_DB_NAME = "relaybase-scale-editor-persistence";
export const OUTBOX_STORE_NAME = "save-outbox";
export const OUTBOX_DB_VERSION = 2;

/** localStorage key for emergency per-file drafts (mirrors `PREFERENCE_KEYS.fileDrafts`). */
export const EMERGENCY_DRAFTS_KEY = "relaybase-scale:campaign-drafts";

/** Maximum number of retry attempts for a failed disk flush. */
export const SAVE_RETRY_MAX_ATTEMPTS = 5;

/** Retry backoff schedule in ms (1s, 3s, 10s, 30s, 30s). */
export const SAVE_RETRY_BACKOFF_MS = [1_000, 3_000, 10_000, 30_000, 30_000];

/** localStorage key for the persistence module's own outbox drain flag. */
export const OUTBOX_DRAIN_FLAG_KEY = "relaybase-scale:outbox-drain";

export const SAVE_STATUS = {
  IDLE: "idle",
  DIRTY: "dirty",
  SAVING: "saving",
  SAVED: "saved",
  ERROR: "error",
} as const;
