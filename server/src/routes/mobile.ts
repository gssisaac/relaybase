import { Hono } from "hono";
import type { Env } from "../env";
import { requireMobilePassword } from "../lib/mobile-auth";
import {
  mobileEnabledAddresses,
  mobileEnabledDomains,
  readMailbox,
  type MailboxAddress,
} from "../lib/catalog-store";
import {
  ackInboxNotifications,
  getInboxAttachmentResult,
  getInboxMessageForDomains,
  inboxCountsForDomains,
  listInboxForDomains,
  listInboxNotificationsForDomains,
  setInboxReadStateMultiDomain,
} from "../lib/mail/list-inbox";
import { sendMailMessage, type SendMailBody } from "../lib/mail/send-message";
import { listSendLogs } from "../lib/send-logs";

const mobile = new Hono<{
  Bindings: Env;
  Variables: {
    mobileDomains: string[];
    mobileAddresses: MailboxAddress[];
  };
}>();

/** Load the mobile-enabled mailbox scope once per request. */
mobile.use("*", async (c, next) => {
  const auth = await requireMobilePassword(c);
  if (auth instanceof Response) return auth;
  const data = await readMailbox(c.env.RELAYBASE_APP);
  const addresses = mobileEnabledAddresses(data);
  const domains = mobileEnabledDomains(data);
  c.set("mobileAddresses", addresses);
  c.set("mobileDomains", domains);
  await next();
});

/** Validate that the mobile session can connect. */
mobile.get("/config", async (c) => {
  // Auth already ran in the middleware; return minimal public metadata.
  return c.json({ ok: true, mobile: true });
});

/** All domains + addresses the mobile app is allowed to see. */
mobile.get("/mailbox", async (c) => {
  const addresses = c.get("mobileAddresses");
  const domains = c.get("mobileDomains");
  return c.json({
    domains,
    addresses: addresses.map((a) => ({
      email: a.email,
      domain: a.domain,
      displayName: a.displayName ?? null,
      inboundEnabled: a.inboundEnabled !== false,
    })),
  });
});

/** Inbox list across all mobile-enabled domains (Gmail "all inboxes"). */
mobile.get("/inbox", async (c) => {
  const domains = c.get("mobileDomains");
  const account = c.req.query("account")?.trim().toLowerCase() || undefined;
  const limit = Number(c.req.query("limit") ?? "50");
  const messages = await listInboxForDomains(c.env, domains, {
    account,
    limit: Number.isFinite(limit) ? limit : 50,
  });
  return c.json({ messages });
});

/** Per-address total/unread counts across mobile-enabled domains. */
mobile.get("/inbox/counts", async (c) => {
  const domains = c.get("mobileDomains");
  const counts = await inboxCountsForDomains(c.env, domains);
  return c.json(counts);
});

/** Bulk mark read/unread. Body: `{ ids: string[], read: boolean }`. */
mobile.post("/inbox/read", async (c) => {
  const domains = c.get("mobileDomains");
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
  const result = await setInboxReadStateMultiDomain(c.env, domains, ids, body.read);
  return c.json(result);
});

/** Message detail. Optional `?domain=` scopes the lookup to one domain. */
mobile.get("/inbox/:id", async (c) => {
  const domains = c.get("mobileDomains");
  const domainHint = c.req.query("domain")?.trim().toLowerCase();
  const lookupDomains = domainHint ? [domainHint] : domains;
  const message = await getInboxMessageForDomains(
    c.env,
    lookupDomains,
    c.req.param("id"),
  );
  if (!message) {
    return c.json({ error: "Message not found" }, 404);
  }
  return c.json({ message });
});

/** Attachment download. Requires `?domain=`. */
mobile.get("/inbox/:id/attachments/:attachmentId", async (c) => {
  const domains = c.get("mobileDomains");
  const domain = c.req.query("domain")?.trim().toLowerCase();
  if (!domain || !domains.includes(domain)) {
    return c.json({ error: "domain query parameter is required" }, 400);
  }
  const result = await getInboxAttachmentResult(c.env, {
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

/** Sent history (read from `srv:sendlog:*`). */
mobile.get("/sent", async (c) => {
  const limit = Number(c.req.query("limit") ?? "50");
  const { logs } = await listSendLogs(c.env.RELAYBASE_APP, {
    limit: Number.isFinite(limit) ? limit : 50,
  });
  return c.json({ sent: logs });
});

/** Send email. `from` must be a mobile-enabled address. */
mobile.post("/send", async (c) => {
  const addresses = c.get("mobileAddresses");
  const allowedFrom = new Set(addresses.map((a) => a.email.toLowerCase()));

  let body: SendMailBody;
  try {
    body = (await c.req.json()) as SendMailBody;
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const from = body.from?.trim().toLowerCase();
  if (!from || !allowedFrom.has(from)) {
    return c.json(
      { error: "From address is not enabled for mobile access" },
      403,
    );
  }

  const result = await sendMailMessage(c.env, body, "mobile");
  return result.response;
});

/** Polling surface for new mail across mobile-enabled domains. */
mobile.get("/notifications", async (c) => {
  const domains = c.get("mobileDomains");
  const limit = Number(c.req.query("limit") ?? "25");
  const events = await listInboxNotificationsForDomains(
    c.env,
    domains,
    Number.isFinite(limit) ? limit : 25,
  );
  return c.json({ events });
});

/** Ack pending events for one domain. Body: `{ domain, ids }`. */
mobile.post("/notifications/ack", async (c) => {
  const domains = c.get("mobileDomains");
  let body: { domain?: string; ids?: string[] };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const domain = body.domain?.trim().toLowerCase();
  if (!domain || !domains.includes(domain)) {
    return c.json({ error: "domain is required" }, 400);
  }
  const ids = body.ids?.filter((id) => typeof id === "string" && id.trim());
  if (!ids?.length) {
    return c.json({ error: "ids must be a non-empty array" }, 400);
  }
  const acked = await ackInboxNotifications(c.env, domain, ids);
  return c.json({ acked });
});

export { mobile };
