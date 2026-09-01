"use client";

import {
  desktopDeleteMailBinary,
  desktopDeleteMailBinaryDir,
  desktopGetMailBinary,
  desktopSaveMailBinary,
  isDesktopRuntime,
} from "@/lib/desktop/bridge";

const IDB_NAME = "relaybase-draft-attachments";
const IDB_STORE = "blobs";
const IDB_VERSION = 1;

function safeSegment(value: string): string {
  return encodeURIComponent(value).replace(/[^a-zA-Z0-9._%-]/g, "_");
}

/** Relative path under `~/.relaybase/{scopeId}/mail/`. */
export function draftAttachmentRelativePath(
  productId: string,
  draftId: string,
  attachmentId: string,
): string {
  const pid = productId.trim().replace(/[^a-zA-Z0-9._%-]/g, "_") || "default";
  return `${pid}/draft-attachments/${safeSegment(draftId)}/${safeSegment(attachmentId)}`;
}

export function draftAttachmentsDirRelativePath(
  productId: string,
  draftId: string,
): string {
  const pid = productId.trim().replace(/[^a-zA-Z0-9._%-]/g, "_") || "default";
  return `${pid}/draft-attachments/${safeSegment(draftId)}`;
}

function idbKey(relativePath: string): string {
  return relativePath;
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

async function idbGet(key: string): Promise<ArrayBuffer | null> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const store = tx.objectStore(IDB_STORE);
    const req = store.get(key);
    req.onerror = () => reject(req.error ?? new Error("IDB get failed"));
    req.onsuccess = () => {
      const value = req.result;
      resolve(value instanceof ArrayBuffer ? value : null);
    };
  });
}

async function idbPut(key: string, value: ArrayBuffer): Promise<void> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    const store = tx.objectStore(IDB_STORE);
    const req = store.put(value, key);
    req.onerror = () => reject(req.error ?? new Error("IDB put failed"));
    req.onsuccess = () => resolve();
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    const store = tx.objectStore(IDB_STORE);
    const req = store.delete(key);
    req.onerror = () => reject(req.error ?? new Error("IDB delete failed"));
    req.onsuccess = () => resolve();
  });
}

async function idbDeletePrefix(prefix: string): Promise<void> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    const store = tx.objectStore(IDB_STORE);
    const req = store.openCursor();
    req.onerror = () => reject(req.error ?? new Error("IDB cursor failed"));
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) {
        resolve();
        return;
      }
      const key = String(cursor.key);
      if (key.startsWith(prefix)) {
        cursor.delete();
      }
      cursor.continue();
    };
  });
}

export async function saveDraftAttachmentBytes(
  productId: string,
  draftId: string,
  attachmentId: string,
  bytes: ArrayBuffer,
): Promise<void> {
  const path = draftAttachmentRelativePath(productId, draftId, attachmentId);
  if (isDesktopRuntime()) {
    const base64 = arrayBufferToBase64(bytes);
    await desktopSaveMailBinary(path, base64);
    return;
  }
  await idbPut(idbKey(path), bytes);
}

export async function loadDraftAttachmentBytes(
  productId: string,
  draftId: string,
  attachmentId: string,
): Promise<ArrayBuffer | null> {
  const path = draftAttachmentRelativePath(productId, draftId, attachmentId);
  if (isDesktopRuntime()) {
    const base64 = await desktopGetMailBinary(path);
    if (!base64) return null;
    return base64ToArrayBuffer(base64);
  }
  return idbGet(idbKey(path));
}

export async function deleteDraftAttachmentBytes(
  productId: string,
  draftId: string,
  attachmentId: string,
): Promise<void> {
  const path = draftAttachmentRelativePath(productId, draftId, attachmentId);
  if (isDesktopRuntime()) {
    await desktopDeleteMailBinary(path);
    return;
  }
  await idbDelete(idbKey(path));
}

export async function deleteDraftAttachmentsDir(
  productId: string,
  draftId: string,
): Promise<void> {
  const dir = draftAttachmentsDirRelativePath(productId, draftId);
  if (isDesktopRuntime()) {
    await desktopDeleteMailBinaryDir(dir);
    return;
  }
  await idbDeletePrefix(`${dir}/`);
}

function arrayBufferToBase64(bytes: ArrayBuffer): string {
  const CHUNK = 0x8000;
  const view = new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < view.length; i += CHUNK) {
    const slice = view.subarray(i, Math.min(i + CHUNK, view.length));
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
