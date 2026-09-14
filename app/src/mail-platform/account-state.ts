/**
 * Plain (non-React) account-state client — the `~/.relaybase/{scopeId}/*`
 * durable-storage replacement described in the storage/cache migration plan.
 *
 * Routes through the existing `desktopAwareFetch("/api/email/...")`, which
 * already resolves to the right Worker surface with no React context needed:
 * desktop → Tauri invoke → `/mail/account-state` (owner bearer); web console
 * → plain fetch → `/mail/account-state`; web/mobile "email" mode → plain
 * fetch → `/mobile/account-state` (mobile password). See
 * `worker/src/routes/account-state-router.ts` for the server side and
 * `worker/src/lib/account-state.ts` for the `(namespace, key)` allow-list —
 * keep the two in sync by hand (the packages aren't in the same build graph).
 */
import { desktopAwareFetch } from "@/lib/desktop/api";

function accountStatePath(namespace: string, key: string): string {
  return `/api/email/account-state/${encodeURIComponent(namespace)}/${encodeURIComponent(key)}`;
}

/** Returns null on any failure (offline, not signed in, unknown key) — callers fall back to their local cache. */
export async function fetchAccountStateJson<T>(
  namespace: string,
  key: string,
): Promise<T | null> {
  try {
    const res = await desktopAwareFetch(accountStatePath(namespace, key));
    if (!res.ok) return null;
    const data = (await res.json()) as { value?: T | null };
    return data.value ?? null;
  } catch {
    return null;
  }
}

/** Throws on failure — callers already wrap writes in their own try/catch or `.catch()`. */
export async function saveAccountStateJson(
  namespace: string,
  key: string,
  value: unknown,
): Promise<void> {
  const res = await desktopAwareFetch(accountStatePath(namespace, key), {
    method: "PUT",
    body: JSON.stringify({ value }),
  });
  if (!res.ok) {
    throw new Error(`account-state write failed (${res.status})`);
  }
}

function draftAttachmentPath(draftId: string, attachmentId: string): string {
  return `/api/email/account-state/drafts/${encodeURIComponent(draftId)}/attachments/${encodeURIComponent(attachmentId)}`;
}

function draftAttachmentsDirPath(draftId: string): string {
  return `/api/email/account-state/drafts/${encodeURIComponent(draftId)}/attachments`;
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

export async function fetchDraftAttachmentBytes(
  draftId: string,
  attachmentId: string,
): Promise<ArrayBuffer | null> {
  try {
    const res = await desktopAwareFetch(draftAttachmentPath(draftId, attachmentId));
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

/**
 * Body is base64-in-JSON, not a raw binary request body — the desktop Tauri
 * invoke bridge only carries a string request body (see
 * `worker/src/routes/account-state-router.ts` for the matching server side).
 */
export async function saveDraftAttachmentBytes(
  draftId: string,
  attachmentId: string,
  bytes: ArrayBuffer,
  meta: { filename: string; contentType?: string },
): Promise<void> {
  const res = await desktopAwareFetch(draftAttachmentPath(draftId, attachmentId), {
    method: "PUT",
    body: JSON.stringify({
      filename: meta.filename,
      contentType: meta.contentType,
      contentBase64: arrayBufferToBase64(bytes),
    }),
  });
  if (!res.ok) {
    throw new Error(`draft attachment upload failed (${res.status})`);
  }
}

export async function deleteDraftAttachmentBytes(
  draftId: string,
  attachmentId: string,
): Promise<void> {
  await desktopAwareFetch(draftAttachmentPath(draftId, attachmentId), {
    method: "DELETE",
  });
}

export async function deleteDraftAttachmentsDir(draftId: string): Promise<void> {
  await desktopAwareFetch(draftAttachmentsDirPath(draftId), { method: "DELETE" });
}
