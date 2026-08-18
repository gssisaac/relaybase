import type { Env } from "../../env";
import {
  ackPendingEvents,
  listPendingEvents,
  type InboundEmailEvent,
} from "../inbound-events";
import {
  getInboundAttachment,
  getInboundEmail,
  getInboundEmailInDomain,
  listInboundEmails,
  MAX_MESSAGES,
  setInboundReadState,
  type InboundEmailMeta,
} from "../inbound-store";
import { aggregateInboundCounts, type InboundCountsResult } from "../inbound-counts";
import {
  serializeInboundListItem,
  serializeInboundMessage,
} from "../inbound-serialize";

export type InboxListItem = ReturnType<typeof serializeInboundListItem>;
export type InboxMessage = ReturnType<typeof serializeInboundMessage>;

export type ListInboxOptions = {
  /** Filter to a single recipient address (lowercased). */
  account?: string;
  limit?: number;
};

function messageAddresses(message: InboundEmailMeta): Set<string> {
  const addresses = new Set<string>();
  const add = (value: string | null | undefined) => {
    const trimmed = value?.trim().toLowerCase();
    if (trimmed) addresses.add(trimmed);
  };
  add(message.toEmail);
  for (const to of message.toEmails ?? []) add(to);
  for (const cc of message.ccEmails ?? []) add(cc);
  return addresses;
}

/**
 * List inbox messages across multiple domains (mobile "all inboxes" view),
 * optionally filtered to a single recipient address. Messages are sorted by
 * `receivedAt` descending and capped at `limit` (max MAX_MESSAGES).
 *
 * Shared by `/mobile/inbox`. The desktop `/mail/inbox` route stays
 * single-domain and calls `listInboundEmails` directly.
 */
export async function listInboxForDomains(
  env: Env,
  domains: string[],
  options: ListInboxOptions = {},
): Promise<InboxListItem[]> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), MAX_MESSAGES);
  const account = options.account?.trim().toLowerCase() || null;

  const collected: InboundEmailMeta[] = [];
  for (const domain of domains) {
    const normalized = domain.trim().toLowerCase();
    if (!normalized) continue;
    const messages = await listInboundEmails(env.INBOUND, {
      domain: normalized,
      limit: MAX_MESSAGES,
    });
    for (const message of messages) {
      if (account) {
        if (!messageAddresses(message).has(account)) continue;
      }
      collected.push(message);
    }
  }

  collected.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  return collected.slice(0, limit).map(serializeInboundListItem);
}

/** Per-address total/unread counts across the supplied domains. */
export async function inboxCountsForDomains(
  env: Env,
  domains: string[],
): Promise<InboundCountsResult> {
  const merged: InboundEmailMeta[] = [];
  for (const domain of domains) {
    const normalized = domain.trim().toLowerCase();
    if (!normalized) continue;
    const messages = await listInboundEmails(env.INBOUND, {
      domain: normalized,
      limit: MAX_MESSAGES,
    });
    merged.push(...messages);
  }
  return aggregateInboundCounts(merged);
}

export async function getInboxMessage(
  env: Env,
  id: string,
  domainHint?: string,
): Promise<InboxMessage | null> {
  const message = await getInboundEmail(env.INBOUND, id, domainHint);
  if (!message) return null;
  return serializeInboundMessage(message);
}

/**
 * Look up a message within a set of domains only (mobile scope). Tries each
 * domain in order and returns the first hit so a request scoped to
 * mobile-enabled domains can never leak a message from a disabled domain.
 */
export async function getInboxMessageForDomains(
  env: Env,
  domains: string[],
  id: string,
): Promise<InboxMessage | null> {
  for (const domain of domains) {
    const normalized = domain.trim().toLowerCase();
    if (!normalized) continue;
    const message = await getInboundEmailInDomain(env.INBOUND, normalized, id);
    if (message) return serializeInboundMessage(message);
  }
  return null;
}

export async function getInboxAttachmentResult(
  env: Env,
  params: { domain: string; messageId: string; attachmentId: string },
) {
  return getInboundAttachment(env.INBOUND, params);
}

/**
 * Bulk mark read/unread for ids that may span multiple domains. Resolves
 * each id's domain by scanning the supplied domains, then groups by domain
 * and applies `setInboundReadState` per domain.
 */
export async function setInboxReadStateMultiDomain(
  env: Env,
  domains: string[],
  ids: string[],
  read: boolean,
): Promise<{ updated: string[] }> {
  const readAt = read ? new Date().toISOString() : null;
  const updated: string[] = [];
  const idSet = new Set(ids.map((id) => id.trim()).filter(Boolean));
  if (idSet.size === 0) return { updated };

  for (const domain of domains) {
    const normalized = domain.trim().toLowerCase();
    if (!normalized) continue;
    if (idSet.size === 0) break;
    const messages = await listInboundEmails(env.INBOUND, {
      domain: normalized,
      limit: MAX_MESSAGES,
    });
    const idsInDomain: string[] = [];
    for (const message of messages) {
      if (idSet.has(message.id)) idsInDomain.push(message.id);
    }
    if (!idsInDomain.length) continue;
    const result = await setInboundReadState(
      env.INBOUND,
      normalized,
      idsInDomain,
      readAt,
    );
    for (const id of result.updated) {
      updated.push(id);
      idSet.delete(id);
    }
  }
  return { updated };
}

/** Pending inbound events across the supplied domains (mobile poll surface). */
export async function listInboxNotificationsForDomains(
  env: Env,
  domains: string[],
  limit = 25,
): Promise<InboundEmailEvent[]> {
  const collected: InboundEmailEvent[] = [];
  for (const domain of domains) {
    const normalized = domain.trim().toLowerCase();
    if (!normalized) continue;
    const events = await listPendingEvents(env.RELAYBASE_APP, normalized, 100);
    collected.push(...events);
  }
  collected.sort((a, b) => b.data.receivedAt.localeCompare(a.data.receivedAt));
  return collected.slice(0, Math.min(Math.max(limit, 1), 100));
}

/** Ack pending events for a single domain (mobile ack). */
export async function ackInboxNotifications(
  env: Env,
  domain: string,
  ids: string[],
): Promise<number> {
  return ackPendingEvents(env.RELAYBASE_APP, domain, ids);
}
