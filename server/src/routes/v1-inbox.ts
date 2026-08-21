import { Hono } from "hono";
import type { Env } from "../env";
import { requireApiKey } from "../lib/auth";
import { createAppDb } from "../../db/app";
import {
  ackPendingEvents,
  listPendingEvents,
} from "../lib/inbound-events";
import {
  getInboundAttachment,
  getInboundEmail,
  listInboundEmailsPage,
  listInboundIndexEntries,
  setInboundReadState,
} from "../lib/inbound-store";
import {
  MIN_SEARCH_QUERY_LENGTH,
  searchInboundEmails,
} from "../lib/inbound-search";
import {
  serializeInboundListItem,
  serializeInboundMessage,
} from "../lib/inbound-serialize";
import { aggregateInboundCounts } from "../lib/inbound-counts";

const v1Inbox = new Hono<{ Bindings: Env }>();

v1Inbox.get("/events", async (c) => {
  const auth = await requireApiKey(c);
  if (auth instanceof Response) return auth;

  const limit = Number(c.req.query("limit") ?? "25");
  const events = await listPendingEvents(createAppDb(c.env.RELAYBASE_DB), auth.record.domain, limit);
  return c.json({ events });
});

v1Inbox.post("/events/ack", async (c) => {
  const auth = await requireApiKey(c);
  if (auth instanceof Response) return auth;

  let body: { ids?: string[] };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const ids = body.ids?.filter((id) => typeof id === "string" && id.trim());
  if (!ids?.length) {
    return c.json({ error: "ids must be a non-empty array" }, 400);
  }

  const acked = await ackPendingEvents(createAppDb(c.env.RELAYBASE_DB), auth.record.domain, ids);
  return c.json({ acked });
});

v1Inbox.get("/messages", async (c) => {
  const auth = await requireApiKey(c);
  if (auth instanceof Response) return auth;

  const limit = Number(c.req.query("limit") ?? "50");
  const before = c.req.query("before")?.trim() || undefined;
  const page = await listInboundEmailsPage(
    c.env.INBOUND,
    {
      domain: auth.record.domain,
      limit: Number.isFinite(limit) ? limit : 50,
      before,
    },
    c.env.RELAYBASE_INBOX_INDEX,
  );

  return c.json({
    messages: page.messages.map(serializeInboundListItem),
    nextBefore: page.nextBefore,
    hasMore: page.hasMore,
    total: page.total,
    unread: page.unread,
  });
});

v1Inbox.get("/messages/counts", async (c) => {
  const auth = await requireApiKey(c);
  if (auth instanceof Response) return auth;

  const entries = await listInboundIndexEntries(
    c.env.INBOUND,
    auth.record.domain,
    c.env.RELAYBASE_INBOX_INDEX,
  );
  return c.json(aggregateInboundCounts(entries));
});

// Server-side full-text search (subject/from/to/cc/body). Flat results.
v1Inbox.get("/messages/search", async (c) => {
  const auth = await requireApiKey(c);
  if (auth instanceof Response) return auth;

  const q = c.req.query("q")?.trim() ?? "";
  if (q.length < MIN_SEARCH_QUERY_LENGTH) {
    return c.json(
      { error: `q must be at least ${MIN_SEARCH_QUERY_LENGTH} characters` },
      400,
    );
  }
  if (!c.env.RELAYBASE_INBOX_INDEX) {
    return c.json({ error: "Search index is not configured" }, 503);
  }

  const limit = Number(c.req.query("limit") ?? "50");
  const before = c.req.query("before")?.trim() || undefined;
  const page = await searchInboundEmails(c.env.RELAYBASE_INBOX_INDEX, {
    domains: [auth.record.domain],
    q,
    limit: Number.isFinite(limit) ? limit : 50,
    before,
  });

  return c.json({
    messages: page.messages.map(serializeInboundListItem),
    total: page.total,
    nextBefore: page.nextBefore,
    hasMore: page.hasMore,
  });
});

v1Inbox.post("/messages/read", async (c) => {
  const auth = await requireApiKey(c);
  if (auth instanceof Response) return auth;

  let body: { ids?: string[]; read?: boolean };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const ids = body.ids?.filter((id) => typeof id === "string" && id.trim());
  if (!ids?.length) {
    return c.json({ error: "ids must be a non-empty array" }, 400);
  }
  if (typeof body.read !== "boolean") {
    return c.json({ error: "read must be a boolean" }, 400);
  }

  const readAt = body.read ? new Date().toISOString() : null;
  const result = await setInboundReadState(
    c.env.INBOUND,
    auth.record.domain,
    ids,
    readAt,
    c.env.RELAYBASE_INBOX_INDEX,
  );
  return c.json(result);
});

v1Inbox.get("/messages/:id/attachments/:attachmentId", async (c) => {
  const auth = await requireApiKey(c);
  if (auth instanceof Response) return auth;

  const result = await getInboundAttachment(c.env.INBOUND, {
    domain: auth.record.domain,
    messageId: c.req.param("id"),
    attachmentId: c.req.param("attachmentId"),
  });
  if (!result) {
    return c.json({ error: "Attachment not found" }, 404);
  }

  const encoded = encodeURIComponent(result.meta.filename);
  return new Response(result.body, {
    headers: {
      "Content-Type": result.meta.contentType,
      "Content-Disposition": `${result.meta.disposition === "inline" ? "inline" : "attachment"}; filename="${result.meta.filename}"; filename*=UTF-8''${encoded}`,
      "Cache-Control": "private, max-age=3600",
    },
  });
});

v1Inbox.get("/messages/:id", async (c) => {
  const auth = await requireApiKey(c);
  if (auth instanceof Response) return auth;

  const message = await getInboundEmail(
    c.env.INBOUND,
    c.req.param("id"),
    auth.record.domain,
  );
  if (!message || message.domain !== auth.record.domain) {
    return c.json({ error: "Message not found" }, 404);
  }

  return c.json({ message: serializeInboundMessage(message) });
});

export { v1Inbox };
