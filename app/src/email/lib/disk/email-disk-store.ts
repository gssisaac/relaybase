"use client";

import {
  desktopGetMailJson,
  desktopSaveMailJson,
  isDesktopRuntime,
} from "@/lib/desktop/bridge";
import type {
  DraftEmail,
  RoutingActivityEvent,
  SentEmail,
} from "@/email/components/mailbox/types";

/** Desktop mail lists/details → ~/.relaybase/mail (see docs/relaybase-home-storage.md). */

function safeProductId(productId: string): string {
  const cleaned = productId.trim().replace(/[^a-zA-Z0-9._%-]/g, "_");
  return cleaned || "default";
}

function safeDetailKey(key: string): string {
  return encodeURIComponent(key).replace(/[^a-zA-Z0-9._%-]/g, "_");
}

function inboxPath(productId: string) {
  return `${safeProductId(productId)}/inbox.json`;
}

function sentPath(productId: string) {
  return `${safeProductId(productId)}/sent.json`;
}

function draftsPath(productId: string) {
  return `${safeProductId(productId)}/drafts.json`;
}

function detailPath(productId: string, messageKey: string) {
  return `${safeProductId(productId)}/details/${safeDetailKey(messageKey)}.json`;
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
    try {
      const remote = await desktopGetMailJson(relativePath);
      if (remote != null) {
        writeLocalJson(relativePath, remote);
        return remote as T;
      }
    } catch {
      // Empty / corrupt disk file — treat as miss.
    }
    // Disk miss: allow one-time migrate from legacy localhost localStorage.
    return readLocalJson<T>(relativePath);
  }
  return readLocalJson<T>(relativePath);
}

async function writeJson(relativePath: string, value: unknown): Promise<void> {
  if (isDesktopRuntime()) {
    // Disk first — do not treat localhost localStorage as durable.
    await desktopSaveMailJson(relativePath, value);
    writeLocalJson(relativePath, value);
    return;
  }
  writeLocalJson(relativePath, value);
}

export type PersistedInboxCache = {
  messages: RoutingActivityEvent[];
  nextBeforeByDomain?: Record<string, string | null>;
  hasMoreByDomain?: Record<string, boolean>;
  /** Whole-mailbox totals from the Worker (per domain). */
  totalByDomain?: Record<string, number>;
  unreadByDomain?: Record<string, number>;
};

export async function loadPersistedInbox(
  productId: string,
): Promise<PersistedInboxCache | null> {
  const data = await readJson<PersistedInboxCache>(inboxPath(productId));
  if (!data?.messages) return null;
  return {
    messages: data.messages,
    nextBeforeByDomain: data.nextBeforeByDomain ?? {},
    hasMoreByDomain: data.hasMoreByDomain ?? {},
    totalByDomain: data.totalByDomain ?? {},
    unreadByDomain: data.unreadByDomain ?? {},
  };
}

export async function savePersistedInbox(
  productId: string,
  cache: PersistedInboxCache,
): Promise<void> {
  await writeJson(inboxPath(productId), {
    messages: cache.messages,
    nextBeforeByDomain: cache.nextBeforeByDomain ?? {},
    hasMoreByDomain: cache.hasMoreByDomain ?? {},
    totalByDomain: cache.totalByDomain ?? {},
    unreadByDomain: cache.unreadByDomain ?? {},
  });
}

export type PersistedSentCache = {
  sent: SentEmail[];
  nextBeforeByDomain?: Record<string, string | null>;
  hasMoreByDomain?: Record<string, boolean>;
  totalByDomain?: Record<string, number>;
};

export async function loadPersistedSent(
  productId: string,
): Promise<PersistedSentCache | null> {
  // Legacy shape was `{ sent }` only — extra fields default to empty.
  const data = await readJson<PersistedSentCache>(sentPath(productId));
  if (!data?.sent) return null;
  return {
    sent: data.sent,
    nextBeforeByDomain: data.nextBeforeByDomain ?? {},
    hasMoreByDomain: data.hasMoreByDomain ?? {},
    totalByDomain: data.totalByDomain ?? {},
  };
}

export async function savePersistedSent(
  productId: string,
  cache: PersistedSentCache,
): Promise<void> {
  await writeJson(sentPath(productId), {
    sent: cache.sent,
    nextBeforeByDomain: cache.nextBeforeByDomain ?? {},
    hasMoreByDomain: cache.hasMoreByDomain ?? {},
    totalByDomain: cache.totalByDomain ?? {},
  });
}

export async function loadPersistedDrafts(
  productId: string,
): Promise<DraftEmail[] | null> {
  const data = await readJson<{ drafts?: DraftEmail[] }>(draftsPath(productId));
  return data?.drafts ?? null;
}

export async function savePersistedDrafts(
  productId: string,
  drafts: DraftEmail[],
): Promise<void> {
  await writeJson(draftsPath(productId), { drafts });
}

export async function loadPersistedDetail(
  productId: string,
  messageKey: string,
): Promise<RoutingActivityEvent | null> {
  return readJson<RoutingActivityEvent>(detailPath(productId, messageKey));
}

export async function savePersistedDetail(
  productId: string,
  message: RoutingActivityEvent,
): Promise<void> {
  if (!message.key) return;
  await writeJson(detailPath(productId, message.key), message);
}
