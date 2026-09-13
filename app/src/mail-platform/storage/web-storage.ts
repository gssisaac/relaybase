/**
 * Web storage — localStorage + IndexedDB fallback for binary blobs.
 *
 * Email mode (web-only) uses the browser's localStorage as the durable
 * store for mail lists, drafts, prefs, and UI state. Binary attachments
 * use IndexedDB (localStorage cannot hold ArrayBuffer efficiently).
 *
 * Key layout mirrors the desktop disk layout: `relaybase:mail:v1:{path}`.
 */
import type { MailStorage } from "../types";

const KEY_PREFIX = "relaybase:mail:v1:";
const IDB_NAME = "relaybase-mail-platform";
const IDB_STORE = "blobs";
const IDB_VERSION = 1;

function localKey(relativePath: string): string {
  return `${KEY_PREFIX}${relativePath}`;
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

export function createWebStorage(): MailStorage {
  return {
    async readJson(relativePath: string): Promise<unknown | null> {
      if (typeof window === "undefined") return null;
      try {
        const raw = localStorage.getItem(localKey(relativePath));
        if (!raw) return null;
        return JSON.parse(raw) as unknown;
      } catch {
        return null;
      }
    },

    async writeJson(relativePath: string, value: unknown): Promise<void> {
      if (typeof window === "undefined") return;
      try {
        localStorage.setItem(localKey(relativePath), JSON.stringify(value));
      } catch {
        // quota / private mode — ignore
      }
    },

    async readBinary(relativePath: string): Promise<ArrayBuffer | null> {
      return idbGet(localKey(relativePath));
    },

    async writeBinary(relativePath: string, value: ArrayBuffer): Promise<void> {
      await idbPut(localKey(relativePath), value);
    },

    async deleteBinary(relativePath: string): Promise<void> {
      await idbDelete(localKey(relativePath));
    },

    async deleteBinaryDir(relativePath: string): Promise<void> {
      await idbDeletePrefix(`${localKey(relativePath)}/`);
    },
  };
}
