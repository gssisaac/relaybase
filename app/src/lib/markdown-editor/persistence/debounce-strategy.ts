/**
 * Trailing + max-wait debounce strategy for autosave.
 *
 * The trailing timer fires `AUTOSAVE_DEBOUNCE_MS` after the last `ingest`.
 * The max-wait timer fires `AUTOSAVE_MAX_WAIT_MS` after the first `ingest`
 * of a dirty burst, forcing a flush even during continuous typing. Both
 * timers reset together when `reset()` is called, and both are cleared
 * when `flushNow()` drains them and invokes the callback.
 *
 * This is layer 3 of the persistence pipeline (see POLICY.md §2).
 */

import { AUTOSAVE_DEBOUNCE_MS, AUTOSAVE_MAX_WAIT_MS } from "./constants";

export type DebounceStrategy = {
  /** Schedule (or reschedule) the trailing timer; arm the max-wait timer. */
  schedule(): void;
  /** Cancel both timers and invoke the pending callback immediately. */
  flushNow(): void;
  /** Cancel both timers without invoking the callback. */
  cancel(): void;
  /** True when either timer is armed. */
  isPending(): boolean;
};

/**
 * Create a debounce strategy. The callback receives no arguments; the
 * coordinator reads the latest content from the adapter when it fires.
 */
export function createDebounceStrategy(onFlush: () => void): DebounceStrategy {
  let trailingTimer: ReturnType<typeof setTimeout> | null = null;
  let maxWaitTimer: ReturnType<typeof setTimeout> | null = null;

  const clearTrailing = () => {
    if (trailingTimer != null) {
      clearTimeout(trailingTimer);
      trailingTimer = null;
    }
  };
  const clearMaxWait = () => {
    if (maxWaitTimer != null) {
      clearTimeout(maxWaitTimer);
      maxWaitTimer = null;
    }
  };

  return {
    schedule() {
      clearTrailing();
      trailingTimer = setTimeout(() => {
        trailingTimer = null;
        clearMaxWait();
        onFlush();
      }, AUTOSAVE_DEBOUNCE_MS);
      if (maxWaitTimer == null) {
        maxWaitTimer = setTimeout(() => {
          maxWaitTimer = null;
          clearTrailing();
          onFlush();
        }, AUTOSAVE_MAX_WAIT_MS);
      }
    },
    flushNow() {
      clearTrailing();
      clearMaxWait();
      onFlush();
    },
    cancel() {
      clearTrailing();
      clearMaxWait();
    },
    isPending() {
      return trailingTimer != null || maxWaitTimer != null;
    },
  };
}
