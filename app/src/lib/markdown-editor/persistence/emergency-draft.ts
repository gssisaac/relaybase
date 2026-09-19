/**
 * Synchronous emergency draft storage.
 *
 * Writes per-file content snapshots to localStorage **synchronously** so
 * that even if the tab is killed mid-async-flush, a recoverable copy
 * survives the page reload. This is layer 4 of the persistence pipeline
 * (see POLICY.md §2).
 *
 * The key shape mirrors `PREFERENCE_KEYS.fileDrafts` so the existing
 * FileStore draft-merge logic continues to work on reload.
 */

import type { StudioPersistRoot } from "./types";
import { readScopedItem, removeScopedItem, writeScopedItem } from "./workspace-storage";
import { EMERGENCY_DRAFTS_KEY } from "./constants";

export type FileDraft = {
  root: StudioPersistRoot;
  path: string;
  content: string;
  updatedAt: number;
};

type FileDraftsMap = Record<string, FileDraft>;

function fileCacheKey(root: StudioPersistRoot, filePath: string): string {
  return `${root}:${filePath}`;
}

function readDraftsMap(): FileDraftsMap {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = readScopedItem(EMERGENCY_DRAFTS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as FileDraftsMap;
  } catch {
    return {};
  }
}

function writeDraftsMap(map: FileDraftsMap): void {
  if (typeof localStorage === "undefined") return;
  try {
    if (Object.keys(map).length === 0) {
      removeScopedItem(EMERGENCY_DRAFTS_KEY);
    } else {
      writeScopedItem(EMERGENCY_DRAFTS_KEY, JSON.stringify(map));
    }
  } catch {
    // Quota or privacy mode — drafts are best-effort. The IndexedDB
    // outbox in `save-outbox.ts` is the secondary durable copy.
  }
}

/**
 * Synchronously write a draft for the given file. Called from the
 * checkpoint pipeline (step 3) and on every `ingest`. Must not throw —
 * quota failures are swallowed so the pipeline continues to the outbox
 * and disk flush.
 */
export function syncEmergencyDraft(root: StudioPersistRoot, filePath: string, content: string): void {
  const map = readDraftsMap();
  map[fileCacheKey(root, filePath)] = {
    root,
    path: filePath,
    content,
    updatedAt: Date.now(),
  };
  writeDraftsMap(map);
}

/** Remove a draft after a successful disk persist. */
export function clearEmergencyDraft(root: StudioPersistRoot, filePath: string): void {
  const map = readDraftsMap();
  const key = fileCacheKey(root, filePath);
  if (!(key in map)) return;
  delete map[key];
  writeDraftsMap(map);
}

/** Read the draft for a file, or null. */
export function readEmergencyDraft(root: StudioPersistRoot, filePath: string): FileDraft | null {
  return readDraftsMap()[fileCacheKey(root, filePath)] ?? null;
}

/** Return all drafts (used by recovery on startup). */
export function readAllEmergencyDrafts(): FileDraft[] {
  return Object.values(readDraftsMap());
}

/**
 * Remove every draft. Used by recovery after a successful outbox drain
 * confirms all pending saves landed on disk. **Not** called on vault
 * disconnect — drafts survive disconnect per POLICY.md §6.
 */
export function clearAllEmergencyDrafts(): void {
  writeDraftsMap({});
}
