import type { Address, RoutingActivityEvent, SentEmail } from "@/email/components/types";
import type { EmailAccountFilter } from "@/email/components/EmailAccountSelect";
import { trimQuotedHistoryForThread } from "@/email/reply-quote-body";

export { joinQuotedBody, splitQuotedBody } from "@/email/reply-quote-body";

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

export function formatQuoteDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const hours = date.getHours();
  const minutes = pad2(date.getMinutes());
  const hour12 = hours % 12 || 12;
  const ampm = hours < 12 ? "AM" : "PM";
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}, ${hour12}:${minutes} ${ampm}`;
}

export {
  draftThreadRowSubtitle,
  formatDraftAttribution,
} from "./draft-thread-rows";

/** Quote only this message’s new content — strip nested reply history first. */
export function quoteInboundMessage(event: RoutingActivityEvent): string {
  const trimmed = trimQuotedHistoryForThread({
    bodyText: event.bodyText,
    bodyPreview: event.bodyPreview,
    bodyHtml: event.bodyHtml,
  });
  const body = trimmed.bodyText.replace(/\s+$/g, "");
  const quoted = body
    ? body
        .split(/\r?\n/)
        .map((line) => `> ${line}`)
        .join("\n")
    : ">";
  return `\n\nOn ${formatQuoteDate(event.receivedAt)}, ${event.fromEmail} wrote:\n\n${quoted}`;
}

export function replyAllCc(
  event: RoutingActivityEvent,
  sendFrom: string,
): string {
  const exclude = new Set(
    [event.fromEmail, sendFrom]
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
  const recipients = [
    ...(event.toEmails?.length ? event.toEmails : [event.toEmail]),
    ...(event.ccEmails ?? []),
  ];
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const email of recipients) {
    const trimmed = email.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (exclude.has(key) || seen.has(key)) continue;
    seen.add(key);
    unique.push(trimmed);
  }
  return unique.join(", ");
}

export function replySubject(subject: string) {
  return subject.startsWith("Re:")
    ? subject
    : `Re: ${subject || "(no subject)"}`;
}

export function forwardSubject(subject: string) {
  const trimmed = subject.trim() || "(no subject)";
  return trimmed.startsWith("Fwd:") ? trimmed : `Fwd: ${trimmed}`;
}

export function resolveReplyFrom(
  event: Pick<RoutingActivityEvent, "toEmail">,
  addresses: Address[],
  fromAccount?: EmailAccountFilter,
  fromOverride?: string | null,
): string {
  const fromQuery = fromOverride?.trim();
  if (fromQuery && addresses.some((a) => a.email === fromQuery)) {
    return fromQuery;
  }
  if (fromAccount && fromAccount !== "all") {
    return fromAccount;
  }
  return (
    addresses.find(
      (a) => a.email.toLowerCase() === event.toEmail.toLowerCase(),
    )?.email ||
    addresses[0]?.email ||
    ""
  );
}

export function buildReplyPrefill(
  event: RoutingActivityEvent,
  addresses: Address[],
  options?: {
    replyAll?: boolean;
    fromAccount?: EmailAccountFilter;
    fromOverride?: string | null;
  },
) {
  const sendFrom = resolveReplyFrom(
    event,
    addresses,
    options?.fromAccount,
    options?.fromOverride,
  );
  return {
    from: sendFrom,
    to: event.fromEmail,
    cc: options?.replyAll ? replyAllCc(event, sendFrom) : "",
    subject: replySubject(event.subject),
    body: quoteInboundMessage(event),
    inReplyTo: event.messageId?.trim() || undefined,
    references: (() => {
      const parentId = event.messageId?.trim();
      if (!parentId) return undefined;
      const prior = event.references?.trim();
      return prior ? `${prior} ${parentId}` : parentId;
    })(),
  };
}

/** Quote a sent stack message (your own) for reply-in-place. */
export function quoteSentMessage(sent: SentEmail): string {
  const trimmed = trimQuotedHistoryForThread({
    bodyText: sent.bodyPreview,
  });
  const body = trimmed.bodyText.replace(/\s+$/g, "");
  const quoted = body
    ? body
        .split(/\r?\n/)
        .map((line) => `> ${line}`)
        .join("\n")
    : ">";
  return `\n\nOn ${formatQuoteDate(sent.sentAt)}, ${sent.from} wrote:\n\n${quoted}`;
}

/**
 * Reply prefill when the focused stack message is one you sent.
 * Keeps To/Cc from that send and quotes that message — not the latest inbound.
 */
export function buildReplyPrefillFromSentMessage(
  sent: SentEmail,
  addresses: Address[],
  options?: {
    replyAll?: boolean;
    fromAccount?: EmailAccountFilter;
    fromOverride?: string | null;
  },
) {
  const fromOverride = options?.fromOverride?.trim();
  const sendFrom =
    (fromOverride &&
    addresses.some((a) => a.email === fromOverride)
      ? fromOverride
      : null) ||
    (options?.fromAccount && options.fromAccount !== "all"
      ? options.fromAccount
      : null) ||
    addresses.find((a) => a.email.toLowerCase() === sent.from.toLowerCase())
      ?.email ||
    addresses[0]?.email ||
    "";
  const parentId = sent.messageId?.trim();
  return {
    from: sendFrom,
    to: sent.to,
    cc: options?.replyAll ? (sent.cc ?? "") : "",
    subject: replySubject(sent.subject),
    body: quoteSentMessage(sent),
    inReplyTo: parentId || undefined,
    references: (() => {
      if (!parentId) return sent.references?.trim() || undefined;
      const prior = sent.references?.trim();
      return prior ? `${prior} ${parentId}` : parentId;
    })(),
  };
}

export type ForwardThreadPart =
  | { kind: "inbound"; event: RoutingActivityEvent }
  | { kind: "sent"; message: SentEmail };

/** Same wire format as reply quotes so ComposeForm shows the quote rail. */
function quoteForwardPart(part: ForwardThreadPart): string {
  if (part.kind === "inbound") {
    return quoteInboundMessage(part.event).replace(/^\n+/, "");
  }
  return quoteSentMessage(part.message).replace(/^\n+/, "");
}

/** Prefix every line with `>` so QuotedReplyBlock nests another rail. */
function indentQuoteLevel(text: string): string {
  return text
    .split("\n")
    .map((line) => (line.length === 0 ? ">" : `> ${line}`))
    .join("\n");
}

/**
 * Nest stack quotes with newest outermost (top, shallow indent) and older
 * messages deeper — matches typical reply quote waterfall.
 * `parts` are oldest → newest (focused last).
 */
export function nestThreadQuotes(parts: ForwardThreadPart[]): string {
  if (parts.length === 0) return "";
  let nested = quoteForwardPart(parts[0]!);
  for (let i = 1; i < parts.length; i++) {
    const outer = quoteForwardPart(parts[i]!);
    nested = `${outer}\n>\n${indentQuoteLevel(nested)}`;
  }
  return nested;
}

/**
 * Reply prefill: addressing/threading from the focused stack (parts last),
 * body quotes oldest→focused with nested rails (same as forward).
 */
export function buildReplyPrefillFromParts(
  parts: ForwardThreadPart[],
  addresses: Address[],
  options?: {
    replyAll?: boolean;
    fromAccount?: EmailAccountFilter;
    fromOverride?: string | null;
  },
) {
  const focus = parts[parts.length - 1];
  if (!focus) {
    return {
      from: addresses[0]?.email ?? "",
      to: "",
      cc: "",
      subject: replySubject(""),
      body: "\n\n",
      inReplyTo: undefined as string | undefined,
      references: undefined as string | undefined,
    };
  }
  const base =
    focus.kind === "inbound"
      ? buildReplyPrefill(focus.event, addresses, options)
      : buildReplyPrefillFromSentMessage(focus.message, addresses, options);
  const quote = nestThreadQuotes(parts);
  return {
    ...base,
    body: quote ? `\n\n${quote}` : "\n\n",
  };
}

function resolveForwardFrom(
  parts: ForwardThreadPart[],
  addresses: Address[],
  options?: {
    fromAccount?: EmailAccountFilter;
    fromOverride?: string | null;
  },
): string {
  const firstInbound = parts.find((p) => p.kind === "inbound");
  if (firstInbound?.kind === "inbound") {
    return resolveReplyFrom(
      firstInbound.event,
      addresses,
      options?.fromAccount,
      options?.fromOverride,
    );
  }
  const firstSent = parts.find((p) => p.kind === "sent");
  if (firstSent?.kind === "sent") {
    const fromOverride = options?.fromOverride?.trim();
    return (
      (fromOverride &&
      addresses.some((a) => a.email === fromOverride)
        ? fromOverride
        : null) ||
      (options?.fromAccount && options.fromAccount !== "all"
        ? options.fromAccount
        : null) ||
      addresses.find(
        (a) => a.email.toLowerCase() === firstSent.message.from.toLowerCase(),
      )?.email ||
      addresses[0]?.email ||
      ""
    );
  }
  return (
    (options?.fromAccount && options.fromAccount !== "all"
      ? options.fromAccount
      : null) ||
    addresses[0]?.email ||
    ""
  );
}

/** Forward prefill — single trimmed message, no reply threading headers. */
export function buildForwardPrefill(
  event: RoutingActivityEvent,
  addresses: Address[],
  options?: {
    fromAccount?: EmailAccountFilter;
    fromOverride?: string | null;
  },
) {
  return buildForwardPrefillFromParts(
    [{ kind: "inbound", event }],
    addresses,
    options,
  );
}

export function buildForwardPrefillFromSent(
  sent: SentEmail,
  addresses: Address[],
  options?: {
    fromAccount?: EmailAccountFilter;
    fromOverride?: string | null;
  },
) {
  return buildForwardPrefillFromParts(
    [{ kind: "sent", message: sent }],
    addresses,
    options,
  );
}

/**
 * Forward history from thread start through the focused stack.
 * Quotes are nested (`>`, `>>`, …) so the compose quote rail shows indentation.
 */
export function buildForwardPrefillFromParts(
  parts: ForwardThreadPart[],
  addresses: Address[],
  options?: {
    fromAccount?: EmailAccountFilter;
    fromOverride?: string | null;
  },
) {
  const sendFrom = resolveForwardFrom(parts, addresses, options);
  const subjectSource =
    parts[0]?.kind === "inbound"
      ? parts[0].event.subject
      : parts[0]?.kind === "sent"
        ? parts[0].message.subject
        : "";
  const quote = nestThreadQuotes(parts);
  return {
    from: sendFrom,
    to: "",
    cc: "",
    subject: forwardSubject(subjectSource),
    body: quote ? `\n\n${quote}` : "\n\n",
  };
}

export function domainOf(email: string) {
  const at = email.indexOf("@");
  return at > 0 ? email.slice(at + 1).toLowerCase() : "";
}
