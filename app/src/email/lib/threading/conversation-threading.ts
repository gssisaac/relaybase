import type {
  RoutingActivityEvent,
  SentEmail,
} from "@/email/components/mailbox/types";
import { formatSenderDisplay } from "@/lib/email/format-sender";

export type ThreadInboundMessage = {
  kind: "inbound";
  id: string;
  at: string;
  message: RoutingActivityEvent;
};

export type ThreadSentMessage = {
  kind: "sent";
  id: string;
  at: string;
  message: SentEmail;
};

export type ThreadMessage = ThreadInboundMessage | ThreadSentMessage;

export type ConversationThread = {
  threadId: string;
  messages: ThreadMessage[];
  latestAt: string;
  subject: string;
  preview: string;
  participantLabel: string;
  /** Latest inbound message key — canonical inbox URL target. */
  latestInboundKey: string;
  inboundKeys: string[];
  messageCount: number;
};

const MESSAGE_ID_TOKEN_RE = /<[^>]+>|[^\s<>]+/g;

/** Normalize RFC Message-ID for comparison (`<id@host>` → `id@host`). */
export function normalizeMessageId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;
  const unwrapped =
    trimmed.startsWith("<") && trimmed.endsWith(">")
      ? trimmed.slice(1, -1).trim()
      : trimmed;
  return unwrapped || null;
}

/** Parse a References / In-Reply-To header into normalized Message-IDs. */
export function parseReferences(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const match of raw.matchAll(MESSAGE_ID_TOKEN_RE)) {
    const id = normalizeMessageId(match[0]);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

class UnionFind {
  private parent = new Map<string, string>();

  find(x: string): string {
    let root = x;
    while (true) {
      const p = this.parent.get(root);
      if (!p || p === root) break;
      root = p;
    }
    let cur = x;
    while (cur !== root) {
      const p = this.parent.get(cur) ?? cur;
      this.parent.set(cur, root);
      cur = p;
    }
    if (!this.parent.has(root)) this.parent.set(root, root);
    return root;
  }

  union(a: string, b: string) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    // Prefer RFC-looking roots (contain @) as canonical when merging.
    const preferA = ra.includes("@") && !rb.includes("@");
    const preferB = rb.includes("@") && !ra.includes("@");
    if (preferB) this.parent.set(ra, rb);
    else this.parent.set(rb, ra);
  }
}

function inboundNodeId(key: string) {
  return `inbound:${key}`;
}

function sentNodeId(id: string) {
  return `sent:${id}`;
}

function rfcNodeId(messageId: string) {
  return `rfc:${messageId}`;
}

function messagePreview(msg: ThreadMessage): string {
  if (msg.kind === "inbound") {
    return (
      msg.message.bodyPreview?.replace(/\s+/g, " ").trim() ||
      msg.message.bodyText?.replace(/\s+/g, " ").trim() ||
      ""
    );
  }
  return msg.message.bodyPreview?.replace(/\s+/g, " ").trim() || "";
}

function formatParticipantLabel(messages: ThreadMessage[]): string {
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const msg of messages) {
    const from =
      msg.kind === "inbound" ? msg.message.fromEmail : msg.message.from;
    const key = from.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    ordered.push(
      formatSenderDisplay(
        msg.kind === "inbound" ? msg.message.fromName : undefined,
        from,
      ),
    );
  }
  if (ordered.length <= 2) return ordered.join(", ");
  return `${ordered[0]}, ${ordered[1]} +${ordered.length - 2}`;
}

function inboundBodyScore(msg: RoutingActivityEvent): number {
  let score = 0;
  if (msg.bodyHtml?.trim()) score += 4;
  if (msg.bodyText?.trim()) score += 2;
  if (msg.bodyPreview?.trim()) score += 1;
  if (msg.attachments?.length) score += msg.attachments.length;
  return score;
}

/** Prefer the richer of two CF-routing copies of the same Message-ID. */
function preferInboundCopy(
  a: RoutingActivityEvent,
  b: RoutingActivityEvent,
): RoutingActivityEvent {
  const scoreA = inboundBodyScore(a);
  const scoreB = inboundBodyScore(b);
  if (scoreB !== scoreA) return scoreB > scoreA ? b : a;
  const toA = a.toEmails?.length ?? 0;
  const toB = b.toEmails?.length ?? 0;
  if (toB !== toA) return toB > toA ? b : a;
  return a.key.localeCompare(b.key) <= 0 ? a : b;
}

/**
 * Cloudflare Email Routing delivers once per matching local address, so the
 * same MIME Message-ID can appear as multiple inbox rows (To + Cc). Collapse
 * those copies before threading so the conversation stack shows one message.
 */
export function collapseDuplicateInbound(
  inbound: RoutingActivityEvent[],
): RoutingActivityEvent[] {
  const byRfc = new Map<string, RoutingActivityEvent>();
  const withoutRfc: RoutingActivityEvent[] = [];
  for (const msg of inbound) {
    const rfc = normalizeMessageId(msg.messageId);
    if (!rfc) {
      withoutRfc.push(msg);
      continue;
    }
    const prev = byRfc.get(rfc);
    byRfc.set(rfc, prev ? preferInboundCopy(prev, msg) : msg);
  }
  return [...byRfc.values(), ...withoutRfc];
}

/** True when the account is envelope To or any MIME To/Cc recipient. */
export function inboundMatchesAccount(
  msg: Pick<RoutingActivityEvent, "toEmail" | "toEmails" | "ccEmails">,
  accountEmail: string,
): boolean {
  const needle = accountEmail.trim().toLowerCase();
  if (!needle) return true;
  if (msg.toEmail.toLowerCase() === needle) return true;
  for (const addr of msg.toEmails ?? []) {
    if (addr.trim().toLowerCase() === needle) return true;
  }
  for (const addr of msg.ccEmails ?? []) {
    if (addr.trim().toLowerCase() === needle) return true;
  }
  return false;
}

/**
 * Sent mail belongs to the From account. When an inbox account filter is set,
 * only that account's outbound copies should join the conversation stack —
 * otherwise a reply from isaac@ shows as "(me)" inside support@'s thread.
 */
export function filterSentForAccount(
  sent: SentEmail[],
  accountEmail: string | "all",
): SentEmail[] {
  if (accountEmail === "all") return sent;
  const needle = accountEmail.trim().toLowerCase();
  if (!needle) return sent;
  return sent.filter((m) => m.from.toLowerCase() === needle);
}

/** Whether a sent row should show the "(me)" marker for the current filter. */
export function sentIsMeForAccount(
  from: string,
  accountEmail: string | "all",
): boolean {
  if (accountEmail === "all") return true;
  const needle = accountEmail.trim().toLowerCase();
  if (!needle) return true;
  return from.trim().toLowerCase() === needle;
}

/**
 * Group inbound + sent messages into conversations using RFC threading headers
 * and Sent.replyKey. Inbox rows should use threads that contain ≥1 inbound.
 */
export function groupConversations(
  inbound: RoutingActivityEvent[],
  sent: SentEmail[],
): ConversationThread[] {
  const uf = new UnionFind();
  const messages: ThreadMessage[] = [];

  for (const m of collapseDuplicateInbound(inbound)) {
    const node = inboundNodeId(m.key);
    uf.find(node);
    const rfc = normalizeMessageId(m.messageId);
    if (rfc) uf.union(node, rfcNodeId(rfc));
    for (const ref of parseReferences(m.inReplyTo)) {
      uf.union(node, rfcNodeId(ref));
    }
    for (const ref of parseReferences(m.references)) {
      uf.union(node, rfcNodeId(ref));
    }
    messages.push({
      kind: "inbound",
      id: m.key,
      at: m.receivedAt,
      message: m,
    });
  }

  for (const m of sent) {
    const node = sentNodeId(m.id);
    uf.find(node);
    const rfc = normalizeMessageId(m.messageId);
    if (rfc) uf.union(node, rfcNodeId(rfc));
    for (const ref of parseReferences(m.inReplyTo)) {
      uf.union(node, rfcNodeId(ref));
    }
    for (const ref of parseReferences(m.references)) {
      uf.union(node, rfcNodeId(ref));
    }
    if (m.replyKey?.trim()) {
      uf.union(node, inboundNodeId(m.replyKey.trim()));
    }
    messages.push({
      kind: "sent",
      id: m.id,
      at: m.sentAt,
      message: m,
    });
  }

  const byRoot = new Map<string, ThreadMessage[]>();
  for (const msg of messages) {
    const node =
      msg.kind === "inbound" ? inboundNodeId(msg.id) : sentNodeId(msg.id);
    const root = uf.find(node);
    const list = byRoot.get(root);
    if (list) list.push(msg);
    else byRoot.set(root, [msg]);
  }

  const threads: ConversationThread[] = [];
  for (const [root, group] of byRoot) {
    const inboundMsgs = group.filter(
      (m): m is ThreadInboundMessage => m.kind === "inbound",
    );
    if (!inboundMsgs.length) continue;

    const sorted = [...group].sort((a, b) => {
      const ta = Date.parse(a.at) || 0;
      const tb = Date.parse(b.at) || 0;
      if (ta !== tb) return ta - tb;
      return a.id.localeCompare(b.id);
    });
    const latest = sorted[sorted.length - 1]!;
    const inboundSorted = [...inboundMsgs].sort((a, b) => {
      const ta = Date.parse(a.at) || 0;
      const tb = Date.parse(b.at) || 0;
      if (ta !== tb) return ta - tb;
      return a.id.localeCompare(b.id);
    });
    const latestInbound = inboundSorted[inboundSorted.length - 1]!;

    threads.push({
      threadId: root,
      messages: sorted,
      latestAt: latest.at,
      subject: latest.message.subject || "(no subject)",
      preview: messagePreview(latest),
      participantLabel: formatParticipantLabel(sorted),
      latestInboundKey: latestInbound.id,
      inboundKeys: inboundSorted.map((m) => m.id),
      messageCount: sorted.length,
    });
  }

  threads.sort((a, b) => {
    const ta = Date.parse(a.latestAt) || 0;
    const tb = Date.parse(b.latestAt) || 0;
    if (ta !== tb) return tb - ta;
    return a.latestInboundKey.localeCompare(b.latestInboundKey);
  });

  return threads;
}

/** Find the conversation that contains an inbound key (any member). */
export function findThreadByInboundKey(
  threads: ConversationThread[],
  inboundKey: string,
): ConversationThread | null {
  const key = inboundKey.trim();
  if (!key) return null;
  return threads.find((t) => t.inboundKeys.includes(key)) ?? null;
}

/** Whether any inbound message in the thread matches account filter. */
export function threadMatchesAccount(
  thread: ConversationThread,
  accountEmail: string,
): boolean {
  const needle = accountEmail.trim().toLowerCase();
  if (!needle) return true;
  return thread.messages.some(
    (m) => m.kind === "inbound" && inboundMatchesAccount(m.message, needle),
  );
}

/** Text/subject/preview match across any message in the thread. */
export function threadMatchesSearch(
  thread: ConversationThread,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return thread.messages.some((m) => {
    if (m.kind === "inbound") {
      const msg = m.message;
      return (
        msg.fromEmail.toLowerCase().includes(q) ||
        msg.toEmail.toLowerCase().includes(q) ||
        (msg.subject || "").toLowerCase().includes(q) ||
        (msg.bodyPreview ?? "").toLowerCase().includes(q) ||
        (msg.bodyText ?? "").toLowerCase().includes(q)
      );
    }
    const msg = m.message;
    return (
      msg.from.toLowerCase().includes(q) ||
      msg.to.toLowerCase().includes(q) ||
      (msg.subject || "").toLowerCase().includes(q) ||
      (msg.bodyPreview ?? "").toLowerCase().includes(q)
    );
  });
}

/** Unread inbound keys within a thread given a read-key set. */
export function threadUnreadKeys(
  thread: ConversationThread,
  isUnread: (key: string) => boolean,
): string[] {
  return thread.inboundKeys.filter((key) => isUnread(key));
}
