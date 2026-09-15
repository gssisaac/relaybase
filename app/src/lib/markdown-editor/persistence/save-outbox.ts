/**
 * IndexedDB write-ahead log for save operations.
 *
 * Every `ingest` and `checkpoint` enqueues an entry here **before** the
 * async disk flush. On success the entry is dequeued; on failure it
 * remains and `recovery.ts` retries it on the next startup / online
 * event. This is layer 4 of the persistence pipeline (see POLICY.md §2).
 *
 * Keys include the workspace folder so a pending save from workspace A
 * cannot be replayed into workspace B. We do not keep history — the
 * FileHistoryPanel / backup store handles version snapshots; the outbox
 * only guarantees the *latest* edit survives.
 */

import type { ScalePersistRoot } from "./types";
import {
  canonicalWorkspacePath,
  getWorkspaceStorageScope,
} from "./workspace-storage";
import {
  OUTBOX_DB_NAME,
  OUTBOX_DB_VERSION,
  OUTBOX_STORE_NAME,
} from "./constants";

export type OutboxEntry = {
  /** `${workspacePath}\\0${root}:${path}` — primary key. */
  id: string;
  root: ScalePersistRoot;
  path: string;
  /** Absolute workspace folder this save belongs to. Missing on legacy v1 rows. */
  workspacePath?: string;
  content: string;
  updatedAt: number;
  /** Number of failed retry attempts so far. */
  attempts: number;
  /** Last error message (truncated) for diagnostics. */
  lastError: string | null;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(OUTBOX_DB_NAME, OUTBOX_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(OUTBOX_STORE_NAME)) {
        db.createObjectStore(OUTBOX_STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Failed to open outbox"));
  });
  return dbPromise;
}

export function resolveOutboxWorkspace(
  workspacePath?: string | null,
): string | null {
  return canonicalWorkspacePath(workspacePath || getWorkspaceStorageScope());
}

export function outboxEntryBelongsToWorkspace(
  entry: Pick<OutboxEntry, "workspacePath">,
  workspacePath: string | null | undefined,
): boolean {
  const scope = resolveOutboxWorkspace(workspacePath);
  const owner = canonicalWorkspacePath(entry.workspacePath);
  return scope != null && owner != null && scope === owner;
}

function outboxId(root: ScalePersistRoot, path: string, workspacePath: string): string {
  return `${workspacePath}\0${root}:${path}`;
}

function tx<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(OUTBOX_STORE_NAME, mode);
        const store = transaction.objectStore(OUTBOX_STORE_NAME);
        const req = fn(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

/**
 * Enqueue (or replace) a pending save entry. Called from the checkpoint
 * pipeline (step 4) and on every `ingest`. The entry is the *latest*
 * content for the file — earlier pending entries are overwritten.
 * Skipped when no workspace is connected so the row cannot leak later.
 */
export async function enqueueSave(
  root: ScalePersistRoot,
  path: string,
  content: string,
  workspacePath?: string | null,
): Promise<void> {
  const scope = resolveOutboxWorkspace(workspacePath);
  if (!scope) return;
  const entry: OutboxEntry = {
    id: outboxId(root, path, scope),
    root,
    path,
    workspacePath: scope,
    content,
    updatedAt: Date.now(),
    attempts: 0,
    lastError: null,
  };
  try {
    await tx("readwrite", (store) => store.put(entry));
  } catch {
    // IndexedDB may be unavailable (private browsing, quota). The
    // localStorage emergency draft in `emergency-draft.ts` is the
    // fallback durable copy — the pipeline continues.
  }
}

/** Synchronous-ish enqueue via a fire-and-forget transaction. */
export function enqueueSaveFireAndForget(
  root: ScalePersistRoot,
  path: string,
  content: string,
  workspacePath?: string | null,
): void {
  void enqueueSave(root, path, content, workspacePath);
}

/** Remove a pending entry after a successful disk persist. */
export async function dequeueSave(
  root: ScalePersistRoot,
  path: string,
  workspacePath?: string | null,
): Promise<void> {
  const scope = resolveOutboxWorkspace(workspacePath);
  if (!scope) return;
  try {
    await tx("readwrite", (store) => store.delete(outboxId(root, path, scope)));
  } catch {
    // Best-effort — a stale entry just triggers a redundant replay.
  }
}

/** Return all pending entries (used by recovery on startup). */
export async function readPendingSaves(): Promise<OutboxEntry[]> {
  try {
    return (await tx<OutboxEntry[]>("readonly", (store) => store.getAll())) ?? [];
  } catch {
    return [];
  }
}

/** Record a failed attempt on an entry so recovery can apply backoff. */
export async function recordFailedAttempt(
  root: ScalePersistRoot,
  path: string,
  error: unknown,
  workspacePath?: string | null,
): Promise<void> {
  const scope = resolveOutboxWorkspace(workspacePath);
  if (!scope) return;
  const message =
    error instanceof Error ? error.message : String(error ?? "unknown error");
  const truncated = message.length > 200 ? message.slice(0, 200) : message;
  try {
    const existing = await tx<OutboxEntry | undefined>("readonly", (store) =>
      store.get(outboxId(root, path, scope)),
    );
    if (!existing) return;
    const next: OutboxEntry = {
      ...existing,
      attempts: existing.attempts + 1,
      lastError: truncated,
    };
    await tx("readwrite", (store) => store.put(next));
  } catch {
    // best-effort
  }
}

/** True when at least one pending entry exists for the given file. */
export async function hasPendingSave(
  root: ScalePersistRoot,
  path: string,
  workspacePath?: string | null,
): Promise<boolean> {
  const scope = resolveOutboxWorkspace(workspacePath);
  if (!scope) return false;
  try {
    const entry = await tx<OutboxEntry | undefined>("readonly", (store) =>
      store.get(outboxId(root, path, scope)),
    );
    return entry != null;
  } catch {
    return false;
  }
}
