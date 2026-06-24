import type { InboundEmailMeta } from "./inbound-store";

export type InboundEmailEvent = {
  id: string;
  type: "inbound.email.received";
  createdAt: string;
  data: {
    messageId: string;
    domain: string;
    from: string;
    to: string;
    subject: string;
    preview: string;
    receivedAt: string;
    hasAttachments: boolean;
  };
};

const EVENT_TTL_SECONDS = 7 * 24 * 60 * 60;
const PREFIX = "event:pending";

function eventKey(domain: string, eventId: string): string {
  return `${PREFIX}:${domain.trim().toLowerCase()}:${eventId}`;
}

function listPrefix(domain: string): string {
  return `${PREFIX}:${domain.trim().toLowerCase()}:`;
}

export async function enqueueInboundEvent(
  kv: KVNamespace,
  meta: InboundEmailMeta,
): Promise<InboundEmailEvent> {
  const eventId = `evt_${meta.id}`;
  const event: InboundEmailEvent = {
    id: eventId,
    type: "inbound.email.received",
    createdAt: new Date().toISOString(),
    data: {
      messageId: meta.id,
      domain: meta.domain,
      from: meta.fromEmail,
      to: meta.toEmail,
      subject: meta.subject,
      preview: meta.bodyPreview,
      receivedAt: meta.receivedAt,
      hasAttachments: meta.attachments.length > 0,
    },
  };

  await kv.put(eventKey(meta.domain, eventId), JSON.stringify(event), {
    expirationTtl: EVENT_TTL_SECONDS,
  });

  return event;
}

export async function listPendingEvents(
  kv: KVNamespace,
  domain: string,
  limit = 25,
): Promise<InboundEmailEvent[]> {
  const normalized = domain.trim().toLowerCase();
  const listed = await kv.list({ prefix: listPrefix(normalized), limit: 100 });
  const events: InboundEmailEvent[] = [];

  for (const key of listed.keys) {
    const raw = await kv.get(key.name);
    if (!raw) continue;
    events.push(JSON.parse(raw) as InboundEmailEvent);
  }

  events.sort((a, b) => b.data.receivedAt.localeCompare(a.data.receivedAt));
  return events.slice(0, Math.min(Math.max(limit, 1), 100));
}

export async function ackPendingEvents(
  kv: KVNamespace,
  domain: string,
  ids: string[],
): Promise<number> {
  const normalized = domain.trim().toLowerCase();
  let deleted = 0;

  for (const id of ids) {
    const key = eventKey(normalized, id);
    const existed = await kv.get(key);
    if (!existed) continue;
    await kv.delete(key);
    deleted++;
  }

  return deleted;
}
