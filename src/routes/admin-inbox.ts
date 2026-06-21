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
import { decodeMimeHeader } from "../lib/mime-parse";

const adminInbox = new Hono<{ Bindings: Env }>();

function decodeSubject(subject: string): string {
  return decodeMimeHeader(subject) || subject || "(no subject)";
}

function serializeMessage(message: Awaited<ReturnType<typeof getInboundEmail>>) {
  if (!message) return null;
  return {
    key: message.id,
    fromEmail: message.fromEmail,
    toEmail: message.toEmail,
    subject: decodeSubject(message.subject),
    status: "stored",
    action: "worker",
    receivedAt: message.receivedAt,
    bodyPreview: message.bodyPreview,
    bodyText: message.bodyText,
    bodyHtml: message.bodyHtml,
    messageId: message.messageId,
    size: message.size,
    attachments: message.attachments.map((attachment) => ({
      ...attachment,
      filename: decodeMimeHeader(attachment.filename) || attachment.filename,
    })),
  };
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
    messages: messages.map((message) => ({
      key: message.id,
      fromEmail: message.fromEmail,
      toEmail: message.toEmail,
      subject: decodeSubject(message.subject),
      status: "stored",
      action: "worker",
      receivedAt: message.receivedAt,
      bodyPreview: message.bodyPreview,
      attachmentCount: message.attachments.length,
      messageId: message.messageId,
      size: message.size,
    })),
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
