import { Hono } from "hono";
import type { Env } from "../env";
import { requireAdmin } from "../lib/auth";
import { readAudienceCatalog } from "../lib/catalog-audience";
import { readBroadcasts } from "../lib/catalog-broadcasts";
import { readMailbox } from "../lib/catalog-store";
import { listSendLogs } from "../lib/send-logs";

const adminStats = new Hono<{ Bindings: Env }>();

adminStats.get("/", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  const domain = c.req.query("domain")?.trim().toLowerCase() || undefined;
  const [mailbox, audience, broadcasts, sendLogs] = await Promise.all([
    readMailbox(c.env.RELAYBASE_APP),
    readAudienceCatalog(c.env.RELAYBASE_APP),
    readBroadcasts(c.env.RELAYBASE_APP),
    listSendLogs(c.env.RELAYBASE_APP, { limit: 500, domain }),
  ]);

  const addresses = domain
    ? mailbox.addresses.filter((a) => a.domain === domain)
    : mailbox.addresses;
  const groups = domain
    ? audience.groups.filter((g) => g.domain === domain)
    : audience.groups;
  const contacts = domain
    ? audience.contacts.filter((ct) => ct.domain === domain)
    : audience.contacts;
  const domainBroadcasts = domain
    ? broadcasts.filter((b) => b.domain === domain)
    : broadcasts;

  return c.json({
    domains: mailbox.domains.length,
    addresses: addresses.length,
    audienceContacts: contacts.length,
    audienceGroups: groups.length,
    broadcasts: domainBroadcasts.length,
    sent: sendLogs.summary.total,
    sendSummary: sendLogs.summary,
    range: c.req.query("range") ?? "all",
  });
});

adminStats.get("/account-stats", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;
  const email = c.req.query("email")?.trim().toLowerCase();
  if (!email) return c.json({ error: "email is required" }, 400);

  const sendLogs = await listSendLogs(c.env.RELAYBASE_APP, { limit: 500 });
  const fromLogs = sendLogs.logs.filter(
    (l) => l.from?.toLowerCase() === email,
  );
  return c.json({
    email,
    sent: fromLogs.length,
    failed: fromLogs.filter((l) => !l.ok).length,
  });
});

adminStats.get("/account-logs", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;
  const email = c.req.query("email")?.trim().toLowerCase();
  if (!email) return c.json({ error: "email is required" }, 400);
  const limit = Math.min(
    Math.max(Number(c.req.query("limit") ?? 50) || 50, 1),
    200,
  );

  const sendLogs = await listSendLogs(c.env.RELAYBASE_APP, { limit: 500 });
  const logs = sendLogs.logs
    .filter((l) => l.from?.toLowerCase() === email)
    .slice(0, limit);
  return c.json({ email, logs });
});

export { adminStats };
