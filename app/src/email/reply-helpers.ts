import type { Address, RoutingActivityEvent } from "@/email/components/types";
import type { EmailAccountFilter } from "@/email/components/EmailAccountSelect";

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

export function quoteInboundMessage(event: RoutingActivityEvent): string {
  const body = (event.bodyText || event.bodyPreview || "").replace(/\s+$/g, "");
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

export function resolveReplyFrom(
  event: RoutingActivityEvent,
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

export function domainOf(email: string) {
  const at = email.indexOf("@");
  return at > 0 ? email.slice(at + 1).toLowerCase() : "";
}
