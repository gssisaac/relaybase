import { Hono } from "hono";
import type { Env } from "../../env";
import { requireAdmin } from "../../lib/auth";
import { createCloudflareClient } from "../../lib/cloudflare-config";
import { createAppDb } from "../../../db/app";
import {
  ensureInboundRouting,
  removeInboundWorkerRouting,
  type InboundRoutingResult,
  type RemoveInboundRoutingResult,
} from "../../lib/inbound-routing";
import {
  getInboundAttachment,
  getInboundEmail,
  listInboundEmailsPage,
  listInboundIndexEntries,
  setInboundReadState,
} from "../../lib/inbound-store";
import {
  MIN_SEARCH_QUERY_LENGTH,
  searchInboundEmails,
} from "../../lib/inbound-search";
import {
  ackPendingEvents,
  listPendingEvents,
} from "../../lib/inbound-events";
import {
  serializeInboundListItem,
  serializeInboundMessage,
} from "../../lib/inbound-serialize";
import { aggregateInboundCounts } from "../../lib/inbound-counts";
import { readMailbox } from "../../lib/catalog-store";

const mailInbox = new Hono<{ Bindings: Env }>();

// Consumed by the desktop mail client (poll + ack) for live inbox updates.
mailInbox.get("/notifications", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  const domain = c.req.query("domain")?.trim().toLowerCase();
  if (!domain) {
    return c.json({ error: "domain query parameter is required" }, 400);
  }

  const limit = Number(c.req.query("limit") ?? "25");
  const events = await listPendingEvents(createAppDb(c.env.RELAYBASE_DB), domain, limit);
  return c.json({ events });
});

mailInbox.post("/notifications/ack", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  let body: { domain?: string; ids?: string[] };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const domain = body.domain?.trim().toLowerCase();
  const ids = body.ids?.filter((id) => typeof id === "string" && id.trim());
  if (!domain) {
    return c.json({ error: "domain is required" }, 400);
  }
  if (!ids?.length) {
    return c.json({ error: "ids must be a non-empty array" }, 400);
  }

  const acked = await ackPendingEvents(createAppDb(c.env.RELAYBASE_DB), domain, ids);
  return c.json({ acked });
});

function serializeMessage(message: Awaited<ReturnType<typeof getInboundEmail>>) {
  if (!message) return null;
  return serializeInboundMessage(message);
}

// Per-address total/unread counts across every retained message for a
// domain — powers the dashboard Accounts list.
mailInbox.get("/counts", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  const domain = c.req.query("domain")?.trim().toLowerCase();
  if (!domain) {
    return c.json({ error: "domain query parameter is required" }, 400);
  }

  // Counts only need To/Cc + readAt, all present on the compact `_list.json`
  // index — no per-message meta.json loads.
  const entries = await listInboundIndexEntries(c.env.INBOUND, domain);
  return c.json(aggregateInboundCounts(entries));
});

// Server-side full-text search (subject/from/to/cc/body) over the D1 FTS
// index. Results are flat messages (no thread grouping), newest first.
mailInbox.get("/search", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  const domain = c.req.query("domain")?.trim().toLowerCase();
  if (!domain) {
    return c.json({ error: "domain query parameter is required" }, 400);
  }
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
    domains: [domain],
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

// Bulk mark-read/unread (desktop client + Cmd+K mail commands).
mailInbox.post("/read", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  let body: { domain?: string; ids?: string[]; read?: boolean };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const domain = body.domain?.trim().toLowerCase();
  const ids = body.ids?.filter((id) => typeof id === "string" && id.trim());
  if (!domain) {
    return c.json({ error: "domain is required" }, 400);
  }
  if (!ids?.length) {
    return c.json({ error: "ids must be a non-empty array" }, 400);
  }
  if (typeof body.read !== "boolean") {
    return c.json({ error: "read must be a boolean" }, 400);
  }

  const readAt = body.read ? new Date().toISOString() : null;
  const result = await setInboundReadState(
    c.env.INBOUND,
    domain,
    ids,
    readAt,
    c.env.RELAYBASE_INBOX_INDEX,
  );
  return c.json(result);
});

mailInbox.get("/", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  const domain = c.req.query("domain")?.trim().toLowerCase();
  if (!domain) {
    return c.json({ error: "domain query parameter is required" }, 400);
  }

  const limit = Number(c.req.query("limit") ?? "50");
  const before = c.req.query("before")?.trim() || undefined;
  const page = await listInboundEmailsPage(c.env.INBOUND, {
    domain,
    limit: Number.isFinite(limit) ? limit : 50,
    before,
  });

  return c.json({
    messages: page.messages.map(serializeInboundListItem),
    nextBefore: page.nextBefore,
    hasMore: page.hasMore,
    total: page.total,
    unread: page.unread,
  });
});

mailInbox.get("/:id/attachments/:attachmentId", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  const domain = c.req.query("domain")?.trim().toLowerCase();
  if (!domain) {
    return c.json({ error: "domain query parameter is required" }, 400);
  }

  const result = await getInboundAttachment(c.env.INBOUND, {
    domain,
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

mailInbox.post("/routing", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  let body: { domain?: string; addresses?: string[] };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const domain = body.domain?.trim().toLowerCase();
  const addresses = body.addresses
    ?.map((address) => address.trim().toLowerCase())
    .filter(Boolean);
  if (!domain) {
    return c.json({ error: "domain is required" }, 400);
  }
  if (!addresses?.length) {
    return c.json({ error: "addresses must be a non-empty array" }, 400);
  }

  try {
    const mailbox = await readMailbox(createAppDb(c.env.RELAYBASE_DB));
    const byEmail = new Map(
      mailbox.addresses.map((a) => [a.email.toLowerCase(), a] as const),
    );
    const entries = addresses.map((address) => ({
      address,
      inboundEnabled: byEmail.get(address)?.inboundEnabled !== false,
    }));
    const cf = await createCloudflareClient(c.env);
    const result: InboundRoutingResult = await ensureInboundRouting(
      cf,
      domain,
      entries,
      c.env.WORKER_SCRIPT_NAME,
    );
    return c.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to configure routing";
    return c.json({ error: message }, 502);
  }
});

mailInbox.delete("/routing", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  let body: { domain?: string; addresses?: string[] };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const domain = body.domain?.trim().toLowerCase();
  const addresses = body.addresses
    ?.map((address) => address.trim().toLowerCase())
    .filter(Boolean);
  if (!domain) {
    return c.json({ error: "domain is required" }, 400);
  }
  if (!addresses?.length) {
    return c.json({ error: "addresses must be a non-empty array" }, 400);
  }

  try {
    const cf = await createCloudflareClient(c.env);
    const result: RemoveInboundRoutingResult = await removeInboundWorkerRouting(
      cf,
      domain,
      addresses,
    );
    return c.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to remove routing";
    return c.json({ error: message }, 502);
  }
});

mailInbox.get("/:id", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  const domain = c.req.query("domain")?.trim().toLowerCase();
  const message = await getInboundEmail(
    c.env.INBOUND,
    c.req.param("id"),
    domain,
  );
  if (!message) {
    return c.json({ error: "Message not found" }, 404);
  }

  return c.json({ message: serializeMessage(message) });
});

export { mailInbox };
