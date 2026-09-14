"use client";

import {
  desktopGetMailJson,
  desktopSaveMailJson,
  isDesktopRuntime,
} from "@/lib/desktop/bridge";
import { desktopAwareFetch } from "@/lib/desktop/api";
import type { EmailBroadcast } from "@/email/components/mailbox/types";

/**
 * Local broadcast drafts → ~/.relaybase/mail/{userId}/broadcast-drafts.json
 *
 * Owner/console-only feature, so the web leg goes through
 * `/console/broadcast-drafts` (a dedicated owner-scoped singleton) rather
 * than `/mail/account-state` — see `worker/src/routes/console/broadcast-drafts.ts`.
 */

async function fetchRemoteBroadcastDrafts<T>(): Promise<T | null> {
  try {
    const res = await desktopAwareFetch("/api/email/broadcast-drafts");
    if (!res.ok) return null;
    const data = (await res.json()) as { value?: T | null };
    return data.value ?? null;
  } catch {
    return null;
  }
}

/** Exported for the one-time desktop→Worker backfill — see `lib/desktop/account-state-migration.ts`. */
export async function saveRemoteBroadcastDrafts(value: unknown): Promise<void> {
  const res = await desktopAwareFetch("/api/email/broadcast-drafts", {
    method: "PUT",
    body: JSON.stringify({ value }),
  });
  if (!res.ok) {
    throw new Error(`broadcast-drafts write failed (${res.status})`);
  }
}

export type LocalBroadcastDraft = EmailBroadcast & {
  status: "draft";
  updatedAt: string;
};

function safeProductId(productId: string): string {
  const cleaned = productId.trim().replace(/[^a-zA-Z0-9._%-]/g, "_");
  return cleaned || "default";
}

function draftsPath(productId: string) {
  return `${safeProductId(productId)}/broadcast-drafts.json`;
}

function localKey(relativePath: string) {
  return `relaybase:mail:v1:${relativePath}`;
}

function readLocalJson<T>(relativePath: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(localKey(relativePath));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeLocalJson(relativePath: string, value: unknown) {
  if (typeof window === "undefined") return;
  if (isDesktopRuntime()) return;
  try {
    localStorage.setItem(localKey(relativePath), JSON.stringify(value));
  } catch {
    // quota / private mode
  }
}

async function readJson<T>(relativePath: string): Promise<T | null> {
  if (isDesktopRuntime()) {
    const remote = await desktopGetMailJson(relativePath);
    if (remote != null) {
      writeLocalJson(relativePath, remote);
      return remote as T;
    }
    return readLocalJson<T>(relativePath);
  }
  return readLocalJson<T>(relativePath);
}

async function writeJson(relativePath: string, value: unknown): Promise<void> {
  if (isDesktopRuntime()) {
    await desktopSaveMailJson(relativePath, value);
    writeLocalJson(relativePath, value);
    return;
  }
  writeLocalJson(relativePath, value);
}

export async function loadPersistedBroadcastDrafts(
  productId: string,
): Promise<LocalBroadcastDraft[] | null> {
  if (isDesktopRuntime()) {
    const data = await readJson<{ drafts?: LocalBroadcastDraft[] }>(
      draftsPath(productId),
    );
    return data?.drafts ?? null;
  }
  const remote = await fetchRemoteBroadcastDrafts<{
    drafts?: LocalBroadcastDraft[];
  }>();
  if (remote?.drafts) {
    writeLocalJson(draftsPath(productId), remote);
    return remote.drafts;
  }
  const data = await readJson<{ drafts?: LocalBroadcastDraft[] }>(
    draftsPath(productId),
  );
  return data?.drafts ?? null;
}

export async function savePersistedBroadcastDrafts(
  productId: string,
  drafts: LocalBroadcastDraft[],
): Promise<void> {
  if (isDesktopRuntime()) {
    await writeJson(draftsPath(productId), { drafts });
    saveRemoteBroadcastDrafts({ drafts }).catch(() => {});
    return;
  }
  writeLocalJson(draftsPath(productId), { drafts });
  await saveRemoteBroadcastDrafts({ drafts });
}
