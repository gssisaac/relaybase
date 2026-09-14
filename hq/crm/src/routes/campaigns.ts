import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { db, DEV_ACCOUNT_LINK_ID } from "../db/client";
import { campaigns, contacts, scheduledJobs, templates } from "../db/schema";
import { newId } from "../lib/ids";
import { renderCampaignForContact } from "../lib/render";
import { sendMail } from "../lib/mail-sender";

export const crmCampaigns = new Hono();

const CRM_BASE_URL = process.env.CRM_PUBLIC_BASE_URL ?? "http://localhost:32831";

function serialize(row: typeof campaigns.$inferSelect) {
  return {
    id: row.id,
    subject: row.subject,
    bodyMarkdown: row.bodyMarkdown,
    templateId: row.templateId,
    status: row.status,
    scheduledAt: row.scheduledAt,
    sentAt: row.sentAt,
    stats: JSON.parse(row.statsJson) as { sent: number; opened: number; clicked: number },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function getTemplateHtml(templateId: string | null): Promise<string | null> {
  if (!templateId) return null;
  const row = await db.select().from(templates).where(eq(templates.id, templateId)).get();
  return row?.htmlSource ?? null;
}

/** Renders + sends to every Contact on the account (v0.2 has no segment builder — see P0-6 note). */
async function dispatchCampaign(campaignId: string): Promise<{ sent: number; failed: number }> {
  const campaign = await db.select().from(campaigns).where(eq(campaigns.id, campaignId)).get();
  if (!campaign) return { sent: 0, failed: 0 };

  const templateHtml =
    (await getTemplateHtml(campaign.templateId)) ?? "<div>{{content}}</div>";
  const recipients = await db
    .select()
    .from(contacts)
    .where(eq(contacts.accountLinkId, DEV_ACCOUNT_LINK_ID));

  let sent = 0;
  let failed = 0;
  const now = new Date().toISOString();

  for (const contact of recipients) {
    const html = renderCampaignForContact({
      campaignId: campaign.id,
      bodyMarkdown: campaign.bodyMarkdown,
      templateHtml,
      contact: { id: contact.id, email: contact.email, name: contact.name },
      crmBaseUrl: CRM_BASE_URL,
    });
    const result = await sendMail({ to: contact.email, subject: campaign.subject, html });
    if (result.ok) {
      sent += 1;
      await db.update(contacts).set({ lastActivityAt: now }).where(eq(contacts.id, contact.id));
    } else {
      failed += 1;
    }
  }

  const stats = { sent, opened: 0, clicked: 0 };
  await db
    .update(campaigns)
    .set({
      status: sent > 0 || recipients.length === 0 ? "sent" : "failed",
      sentAt: now,
      statsJson: JSON.stringify(stats),
      updatedAt: now,
    })
    .where(eq(campaigns.id, campaignId));

  return { sent, failed };
}

// GET /crm/campaigns
crmCampaigns.get("/", async (c) => {
  const rows = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.accountLinkId, DEV_ACCOUNT_LINK_ID))
    .orderBy(desc(campaigns.createdAt));
  return c.json({ campaigns: rows.map(serialize) });
});

// POST /crm/campaigns { subject?, templateId? } — always creates a draft
crmCampaigns.post("/", async (c) => {
  let body: { subject?: string; templateId?: string } = {};
  try {
    body = await c.req.json();
  } catch {
    // empty body is fine — bare "New campaign" draft
  }

  const id = newId("campaign");
  const now = new Date().toISOString();
  await db.insert(campaigns).values({
    id,
    accountLinkId: DEV_ACCOUNT_LINK_ID,
    subject: body.subject ?? "",
    bodyMarkdown: "",
    templateId: body.templateId ?? null,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  });

  const row = await db.select().from(campaigns).where(eq(campaigns.id, id)).get();
  return c.json(serialize(row!), 201);
});

// GET /crm/campaigns/:id
crmCampaigns.get("/:id", async (c) => {
  const row = await db.select().from(campaigns).where(eq(campaigns.id, c.req.param("id"))).get();
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(serialize(row));
});

// PATCH /crm/campaigns/:id { subject?, bodyMarkdown?, templateId? } — autosave (P0-6)
crmCampaigns.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await db.select().from(campaigns).where(eq(campaigns.id, id)).get();
  if (!existing) return c.json({ error: "not found" }, 404);
  if (existing.status !== "draft" && existing.status !== "failed") {
    return c.json({ error: "sent campaigns cannot be edited" }, 409);
  }

  let body: { subject?: string; bodyMarkdown?: string; templateId?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }

  await db
    .update(campaigns)
    .set({
      subject: body.subject,
      bodyMarkdown: body.bodyMarkdown,
      templateId: body.templateId,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(campaigns.id, id));

  const row = await db.select().from(campaigns).where(eq(campaigns.id, id)).get();
  return c.json(serialize(row!));
});

// POST /crm/campaigns/:id/send — immediate send (flow A)
crmCampaigns.post("/:id/send", async (c) => {
  const id = c.req.param("id");
  const existing = await db.select().from(campaigns).where(eq(campaigns.id, id)).get();
  if (!existing) return c.json({ error: "not found" }, 404);
  if (existing.status !== "draft" && existing.status !== "failed") {
    return c.json({ error: `cannot send from status "${existing.status}"` }, 409);
  }

  await db
    .update(campaigns)
    .set({ status: "sending", updatedAt: new Date().toISOString() })
    .where(eq(campaigns.id, id));

  const result = await dispatchCampaign(id);
  const row = await db.select().from(campaigns).where(eq(campaigns.id, id)).get();
  return c.json({ campaign: serialize(row!), ...result });
});

// POST /crm/campaigns/:id/test-send { to }
crmCampaigns.post("/:id/test-send", async (c) => {
  const id = c.req.param("id");
  const campaign = await db.select().from(campaigns).where(eq(campaigns.id, id)).get();
  if (!campaign) return c.json({ error: "not found" }, 404);

  let body: { to?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }
  const to = body.to?.trim();
  if (!to || !to.includes("@")) {
    return c.json({ error: "a valid recipient email is required" }, 400);
  }

  const templateHtml = (await getTemplateHtml(campaign.templateId)) ?? "<div>{{content}}</div>";
  const html = renderCampaignForContact({
    campaignId: campaign.id,
    bodyMarkdown: campaign.bodyMarkdown,
    templateHtml,
    contact: { id: "test", email: to, name: null },
    crmBaseUrl: CRM_BASE_URL,
  });
  const result = await sendMail({ to, subject: `[Test] ${campaign.subject}`, html });
  if (!result.ok) return c.json({ error: result.error }, 502);
  return c.json({ ok: true });
});

// POST /crm/campaigns/:id/schedule { runAt } — P0-5
crmCampaigns.post("/:id/schedule", async (c) => {
  const id = c.req.param("id");
  const campaign = await db.select().from(campaigns).where(eq(campaigns.id, id)).get();
  if (!campaign) return c.json({ error: "not found" }, 404);
  if (campaign.status !== "draft") {
    return c.json({ error: `cannot schedule from status "${campaign.status}"` }, 409);
  }

  let body: { runAt?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }
  const runAt = body.runAt;
  if (!runAt || new Date(runAt).getTime() <= Date.now()) {
    return c.json({ error: "runAt must be a future time" }, 400);
  }

  await db.insert(scheduledJobs).values({
    id: newId("job"),
    accountLinkId: DEV_ACCOUNT_LINK_ID,
    kind: "campaign",
    refId: id,
    runAt,
    status: "pending",
    createdAt: new Date().toISOString(),
  });
  await db
    .update(campaigns)
    .set({ status: "scheduled", scheduledAt: runAt, updatedAt: new Date().toISOString() })
    .where(eq(campaigns.id, id));

  const row = await db.select().from(campaigns).where(eq(campaigns.id, id)).get();
  return c.json(serialize(row!));
});

// POST /crm/campaigns/:id/cancel-schedule
crmCampaigns.post("/:id/cancel-schedule", async (c) => {
  const id = c.req.param("id");
  const campaign = await db.select().from(campaigns).where(eq(campaigns.id, id)).get();
  if (!campaign) return c.json({ error: "not found" }, 404);
  if (campaign.status !== "scheduled") {
    return c.json({ error: "already sent — cannot cancel" }, 409);
  }

  const job = await db
    .select()
    .from(scheduledJobs)
    .where(eq(scheduledJobs.refId, id))
    .get();
  if (job && job.status === "pending") {
    await db.delete(scheduledJobs).where(eq(scheduledJobs.id, job.id));
  } else if (job) {
    return c.json({ error: "send already started; cannot cancel" }, 409);
  }

  await db
    .update(campaigns)
    .set({ status: "draft", scheduledAt: null, updatedAt: new Date().toISOString() })
    .where(eq(campaigns.id, id));

  const row = await db.select().from(campaigns).where(eq(campaigns.id, id)).get();
  return c.json(serialize(row!));
});

export { dispatchCampaign };
