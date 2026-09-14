/**
 * Browser & route lifecycle event subscription.
 *
 * This is the **only** place in the codebase that subscribes to
 * `beforeunload`, `pagehide`, `visibilitychange`, `hashchange`, `popstate`,
 * `freeze`, and `unload` for save purposes. The coordinator's
 * `checkpoint` / `checkpointSync` methods handle the actual save — this
 * module just wires the right event to the right checkpoint reason.
 *
 * See POLICY.md §3 for the full event table.
 *
 * `hashchange` and `popstate` run **in parallel** with `router.ts`'s
 * `subscribeRoute`. The router updates UI state; this module runs the
 * save checkpoint. They do not conflict — the checkpoint reads the
 * *previous* route from the coordinator's `getEditContext` ref (which
 * the App updates synchronously via `routeRef`), so by the time the
 * event fires the coordinator still knows which file is leaving.
 */

import type { EditorPersistenceCoordinator } from "./coordinator";
import type { CheckpointReason } from "./types";

type ListenerHandle = {
  type: string;
  target: EventTarget;
  handler: EventListenerOrEventListenerObject;
  options?: boolean | AddEventListenerOptions;
};

function add(
  handles: ListenerHandle[],
  target: EventTarget,
  type: string,
  handler: EventListenerOrEventListenerObject,
  options?: boolean | AddEventListenerOptions,
): void {
  target.addEventListener(type, handler, options);
  handles.push({ type, target, handler, options });
}

/**
 * Attach all lifecycle listeners to the coordinator. Returns a cleanup
 * function that removes every listener — call it on app unmount.
 */
export function attachLifecycleListeners(
  coordinator: EditorPersistenceCoordinator,
): () => void {
  const handles: ListenerHandle[] = [];

  // --- Route changes (in-app navigation) ------------------------------
  //
  // `hashchange` fires for any URL hash change — programmatic
  // `navigate()`/`navigateSettings()`, link clicks, and manual URL
  // edits. We run a checkpoint *before* the route state propagates so
  // the editor's current content is saved under the leaving file.
  add(handles, window, "hashchange", () => {
    void coordinator.checkpoint("route-hashchange");
  });

  // `popstate` fires for browser back/forward. The router's own
  // `popstate` handler updates UI state; this one saves.
  add(handles, window, "popstate", () => {
    void coordinator.checkpoint("route-popstate");
  });

  // --- Tab / window close ---------------------------------------------
  //
  // Run the sync pipeline (draft + outbox + beacon). Do **not** call
  // `preventDefault` — the native "Reload site?" / "leave site?" prompt
  // is unnecessary. Drafts + outbox survive reload and recovery replays
  // automatically (POLICY.md §3 / §9).
  add(handles, window, "beforeunload", () => {
    coordinator.checkpointSync("beforeunload");
  });

  // `pagehide` is the modern replacement for `unload` and fires reliably
  // on tab close, bfcache entry, and mobile backgrounding. When
  // `persisted` is true the page is going into bfcache (the `freeze`
  // event will follow); when false the page is being destroyed.
  add(handles, window, "pagehide", (event) => {
    coordinator.checkpointSync("pagehide");
    const pageTransition = event as PageTransitionEvent;
    if (!pageTransition.persisted) {
      // Page is being destroyed — also kick off an async flush in case
      // the browser gives us enough time. The sync draft + outbox are
      // already written by `checkpointSync`.
      void coordinator.checkpoint("pagehide-async");
    }
  });

  // --- Visibility (tab switch / minimize) -----------------------------
  //
  // `visibilitychange` with `hidden` is the most reliable cross-browser
  // signal that the user has switched away. It fires before `pagehide`
  // on mobile and is the recommended checkpoint event per the Page
  // Lifecycle API.
  add(handles, document, "visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      void coordinator.checkpoint("visibility-hidden");
    }
  });

  // --- bfcache freeze (progressive enhancement) -----------------------
  //
  // The `freeze` event fires when a page enters bfcache. No async work
  // is allowed after `freeze` — only sync storage writes. We write the
  // draft + outbox and return.
  add(handles, document, "freeze", () => {
    coordinator.checkpointSync("freeze");
  });

  // --- Legacy unload fallback ------------------------------------------
  //
  // `unload` is deprecated and unreliable, but some browsers (and some
  // enterprise policy configurations) still only fire it. We do a
  // sync-only checkpoint — no async fetch, no beacon (beacons queued
  // during `unload` are not guaranteed to deliver).
  add(handles, window, "unload", () => {
    coordinator.checkpointSync("unload");
  });

  // --- Online retry trigger -------------------------------------------
  //
  // When the network comes back after a failed save, immediately retry
  // any pending outbox entries. The coordinator's checkpoint will pick
  // up the current file; `recovery.ts` handles the rest.
  add(handles, window, "online", () => {
    void coordinator.checkpoint("visibility-hidden");
  });

  return () => {
    for (const handle of handles) {
      handle.target.removeEventListener(handle.type, handle.handler, handle.options);
    }
    handles.length = 0;
  };
}

/** Re-export the reason type for callers that build their own triggers. */
export type { CheckpointReason };
