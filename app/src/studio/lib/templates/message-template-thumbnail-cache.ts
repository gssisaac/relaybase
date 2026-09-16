import type { MessageTemplateThumbnailSource } from "@/studio/lib/templates/render-message-template-thumbnail-html";
import type { TemplateVariablesSchema } from "@/studio/lib/layouts/layout-template-variables";

/** Bump when capture dimensions/HTML wrapper change to invalidate stale blobs. */
export const MESSAGE_TEMPLATE_THUMBNAIL_CAPTURE_VERSION = 1;

const DB_NAME = "relaybase-message-template-thumbnails";
const DB_VERSION = 1;
const STORE = "png";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("indexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("idb open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
  });
}

async function hashSource(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 20);
}

export async function messageTemplateThumbnailCacheKey(input: {
  templateId: string;
  template: MessageTemplateThumbnailSource;
  layoutId: string;
  layoutHtmlSource: string;
  variablesSchema: TemplateVariablesSchema | null | undefined;
}): Promise<string> {
  const schemaJson = input.variablesSchema ? JSON.stringify(input.variablesSchema) : "";
  const templateJson = JSON.stringify({
    body: input.template.bodyMarkdown,
    layoutId: input.template.layoutId,
    vars: input.template.templateVariables,
    subject: input.template.subject,
  });
  const layoutHash = await hashSource(`${input.layoutHtmlSource}\0${schemaJson}`);
  const templateHash = await hashSource(templateJson);
  return `v${MESSAGE_TEMPLATE_THUMBNAIL_CAPTURE_VERSION}:${input.templateId}:${layoutHash}:${templateHash}`;
}

export async function readCachedMessageTemplateThumbnail(cacheKey: string): Promise<Blob | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(cacheKey);
      req.onerror = () => reject(req.error ?? new Error("idb get failed"));
      req.onsuccess = () => {
        const value = req.result;
        resolve(value instanceof Blob ? value : null);
      };
    });
  } catch {
    return null;
  }
}

export async function writeCachedMessageTemplateThumbnail(
  cacheKey: string,
  blob: Blob,
): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const req = tx.objectStore(STORE).put(blob, cacheKey);
      req.onerror = () => reject(req.error ?? new Error("idb put failed"));
      req.onsuccess = () => resolve();
    });
  } catch {
    // Best-effort cache.
  }
}
