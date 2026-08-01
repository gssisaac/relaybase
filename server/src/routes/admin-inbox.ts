import { Hono } from "hono";
import type { Env } from "../env";
import { requireAdmin } from "../lib/auth";
import { createCloudflareClient } from "../lib/cloudflare-config";
import {
  ensureInboundWorkerRouting,
  type InboundRoutingResult,
} from "../lib/inbound-routing";
import {
  getInboundAttachment,
  getInboundEmail,
  listInboundEmails,
} from "../lib/inbound-store";
import {
  ackPendingEvents,
  listPendingEvents,
} from "../lib/inbound-events";
import {
  serializeInboundListItem,
  serializeInboundMessage,
} from "../lib/inbound-serialize";

const adminInbox = new Hono<{ Bindings: Env }>();

adminInbox.get("/notifications", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  const domain = c.req.query("domain")?.trim().toLowerCase();
  if (!domain) {
    return c.json({ error: "domain query parameter is required" }, 400);
  }

  const limit = Number(c.req.query("limit") ?? "25");
  const events = await listPendingEvents(c.env.KEYS, domain, limit);
  return c.json({ events });
});

adminInbox.post("/notifications/ack", async (c) => {
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

  const acked = await ackPendingEvents(c.env.KEYS, domain, ids);
  return c.json({ acked });
});

function serializeMessage(message: Awaited<ReturnType<typeof getInboundEmail>>) {
  if (!message) return null;
  return serializeInboundMessage(message);
}

adminInbox.get("/", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  const domain = c.req.query("domain")?.trim().toLowerCase();
  if (!domain) {
    return c.json({ error: "domain query parameter is required" }, 400);
  }

  const limit = Number(c.req.query("limit") ?? "50");
  const messages = await listInboundEmails(c.env.INBOUND, {
    domain,
    limit: Number.isFinite(limit) ? limit : 50,
  });

  return c.json({
    messages: messages.map(serializeInboundListItem),
  });
});

adminInbox.get("/:id/attachments/:attachmentId", async (c) => {
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

adminInbox.get("/:id", async (c) => {
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

adminInbox.post("/routing", async (c) => {
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
    const result: InboundRoutingResult = await ensureInboundWorkerRouting(
      cf,
      domain,
      addresses,
      c.env.WORKER_SCRIPT_NAME,
    );
    return c.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to configure routing";
    return c.json({ error: message }, 502);
  }
});

export { adminInbox };
