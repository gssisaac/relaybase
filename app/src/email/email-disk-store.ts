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
} from "@/email/components/types";

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
      if (remote != null) return remote as T;
    } catch {
      // fall through
    }
  }
  return readLocalJson<T>(relativePath);
}

async function writeJson(relativePath: string, value: unknown): Promise<void> {
  writeLocalJson(relativePath, value);
  if (isDesktopRuntime()) {
    try {
      await desktopSaveMailJson(relativePath, value);
    } catch {
      // local mirror already written
    }
  }
}

export async function loadPersistedInbox(
  productId: string,
): Promise<RoutingActivityEvent[] | null> {
  const data = await readJson<{ messages?: RoutingActivityEvent[] }>(
    inboxPath(productId),
  );
  return data?.messages ?? null;
}

export async function savePersistedInbox(
  productId: string,
  messages: RoutingActivityEvent[],
): Promise<void> {
  await writeJson(inboxPath(productId), { messages });
}

export async function loadPersistedSent(
  productId: string,
): Promise<SentEmail[] | null> {
  const data = await readJson<{ sent?: SentEmail[] }>(sentPath(productId));
  return data?.sent ?? null;
}

export async function savePersistedSent(
  productId: string,
  sent: SentEmail[],
): Promise<void> {
  await writeJson(sentPath(productId), { sent });
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
