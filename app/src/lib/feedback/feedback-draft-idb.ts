"use client";

const IDB_NAME = "relaybase-feedback-draft";
const IDB_STORE = "blobs";
const IDB_VERSION = 1;

function idbKey(attachmentId: string): string {
  return `feedback-draft/${attachmentId}`;
}

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("Failed to open IDB"));
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

export async function readFeedbackDraftBytes(
  attachmentId: string,
): Promise<ArrayBuffer | null> {
  const db = await openIdb();
  const key = idbKey(attachmentId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onerror = () => reject(req.error ?? new Error("IDB get failed"));
    req.onsuccess = () => {
      const value = req.result;
      resolve(value instanceof ArrayBuffer ? value : null);
    };
  });
}

export async function writeFeedbackDraftBytes(
  attachmentId: string,
  bytes: ArrayBuffer,
): Promise<void> {
  const db = await openIdb();
  const key = idbKey(attachmentId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    const req = tx.objectStore(IDB_STORE).put(bytes, key);
    req.onerror = () => reject(req.error ?? new Error("IDB put failed"));
    req.onsuccess = () => resolve();
  });
}

export async function deleteFeedbackDraftBytes(
  attachmentId: string,
): Promise<void> {
  const db = await openIdb();
  const key = idbKey(attachmentId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    const req = tx.objectStore(IDB_STORE).delete(key);
    req.onerror = () => reject(req.error ?? new Error("IDB delete failed"));
    req.onsuccess = () => resolve();
  });
}

export async function clearAllFeedbackDraftBytes(): Promise<void> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    const req = tx.objectStore(IDB_STORE).clear();
    req.onerror = () => reject(req.error ?? new Error("IDB clear failed"));
    req.onsuccess = () => resolve();
  });
}
