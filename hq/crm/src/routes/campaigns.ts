import { Hono } from "hono";
import { DEV_ACCOUNT_LINK_ID, store } from "../db/store";
import type { Campaign } from "../db/types";
import { newId } from "../lib/ids";
import { renderCampaignForRecipient } from "../lib/render";
import { sendMail } from "../lib/mail-sender";

export const crmCampaigns = new Hono();

const CRM_BASE_URL = process.env.CRM_PUBLIC_BASE_URL ?? "http://localhost:32831";

export type CampaignRecipient = { email: string; name?: string | null };

function serialize(row: Campaign) {
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

function getTemplateHtml(templateId: string | null): string | null {
  if (!templateId) return null;
  const data = store.read();
  const row = data.templates.find((t) => t.id === templateId);
  return row?.htmlSource ?? null;
}

function normalizeRecipients(raw: unknown): CampaignRecipient[] {
  if (!Array.isArray(raw)) return [];
  const out: CampaignRecipient[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const email = String((item as { email?: string }).email ?? "")
      .trim()
      .toLowerCase();
    if (!email.includes("@") || seen.has(email)) continue;
    seen.add(email);
    const name = (item as { name?: string }).name;
    out.push({ email, name: name?.trim() || null });
  }
  return out;
}

/** Audience lives on the customer Worker — client supplies resolved recipients at send time. */
export async function dispatchCampaign(
  campaignId: string,
  recipients: CampaignRecipient[],
): Promise<{ sent: number; failed: number }> {
  const data = store.read();
  const campaign = data.campaigns.find((c) => c.id === campaignId);
  if (!campaign) return { sent: 0, failed: 0 };

  const templateHtml = getTemplateHtml(campaign.templateId) ?? "<div>{{content}}</div>";

  let sent = 0;
  let failed = 0;
  const now = new Date().toISOString();

  for (const recipient of recipients) {
    const html = renderCampaignForRecipient({
      campaignId: campaign.id,
      bodyMarkdown: campaign.bodyMarkdown,
      templateHtml,
      recipient,
      crmBaseUrl: CRM_BASE_URL,
    });
    const result = await sendMail({ to: recipient.email, subject: campaign.subject, html });
    if (result.ok) sent += 1;
    else failed += 1;
  }

  const stats = { sent, opened: 0, clicked: 0 };
  store.update((draft) => {
    const idx = draft.campaigns.findIndex((c) => c.id === campaignId);
    if (idx < 0) return;
    draft.campaigns[idx] = {
      ...draft.campaigns[idx]!,
      status: sent > 0 || recipients.length === 0 ? "sent" : "failed",
      sentAt: now,
      statsJson: JSON.stringify(stats),
      updatedAt: now,
    };
  });

  return { sent, failed };
}

// GET /crm/campaigns
crmCampaigns.get("/", async (c) => {
  const data = store.read();
  const rows = data.campaigns
    .filter((row) => row.accountLinkId === DEV_ACCOUNT_LINK_ID)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return c.json({ campaigns: rows.map(serialize) });
});

// POST /crm/campaigns { subject?, templateId? }
crmCampaigns.post("/", async (c) => {
  let body: { subject?: string; templateId?: string } = {};
  try {
    body = await c.req.json();
  } catch {
    /* empty body */
  }

  const id = newId("campaign");
  const now = new Date().toISOString();
  let created: Campaign | null = null;
  store.update((draft) => {
    created = {
      id,
      accountLinkId: DEV_ACCOUNT_LINK_ID,
      subject: body.subject ?? "",
      bodyMarkdown: "",
      templateId: body.templateId ?? null,
      segmentJson: "{}",
      status: "draft",
      scheduledAt: null,
      sentAt: null,
      statsJson: '{"sent":0,"opened":0,"clicked":0}',
      createdAt: now,
      updatedAt: now,
    };
    draft.campaigns.push(created);
  });

  return c.json(serialize(created!), 201);
});

// GET /crm/campaigns/:id
crmCampaigns.get("/:id", async (c) => {
  const row = store.read().campaigns.find((r) => r.id === c.req.param("id"));
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(serialize(row));
});

// PATCH /crm/campaigns/:id
crmCampaigns.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const data = store.read();
  const existing = data.campaigns.find((r) => r.id === id);
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

  let updated: Campaign | null = null;
  store.update((draft) => {
    const idx = draft.campaigns.findIndex((r) => r.id === id);
    if (idx < 0) return;
    draft.campaigns[idx] = {
      ...draft.campaigns[idx]!,
      subject: body.subject ?? draft.campaigns[idx]!.subject,
      bodyMarkdown: body.bodyMarkdown ?? draft.campaigns[idx]!.bodyMarkdown,
      templateId: body.templateId !== undefined ? body.templateId : draft.campaigns[idx]!.templateId,
      updatedAt: new Date().toISOString(),
    };
    updated = draft.campaigns[idx]!;
  });

  return c.json(serialize(updated!));
});

// POST /crm/campaigns/:id/send { recipients?: { email, name? }[] }
crmCampaigns.post("/:id/send", async (c) => {
  const id = c.req.param("id");
  const existing = store.read().campaigns.find((r) => r.id === id);
  if (!existing) return c.json({ error: "not found" }, 404);
  if (existing.status !== "draft" && existing.status !== "failed") {
    return c.json({ error: `cannot send from status "${existing.status}"` }, 409);
  }

  let body: { recipients?: unknown } = {};
  try {
    body = await c.req.json();
  } catch {
    /* no body */
  }
  const recipients = normalizeRecipients(body.recipients);
  if (recipients.length === 0) {
    return c.json(
      {
        error:
          "recipients required — resolve audience members from your Worker and pass them in the request body",
      },
      400,
    );
  }

  store.update((draft) => {
    const idx = draft.campaigns.findIndex((r) => r.id === id);
    if (idx >= 0) {
      draft.campaigns[idx] = {
        ...draft.campaigns[idx]!,
        status: "sending",
        updatedAt: new Date().toISOString(),
      };
    }
  });

  const result = await dispatchCampaign(id, recipients);
  const row = store.read().campaigns.find((r) => r.id === id)!;
  return c.json({ campaign: serialize(row), ...result });
});

// POST /crm/campaigns/:id/test-send { to }
crmCampaigns.post("/:id/test-send", async (c) => {
  const campaign = store.read().campaigns.find((r) => r.id === c.req.param("id"));
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

  const templateHtml = getTemplateHtml(campaign.templateId) ?? "<div>{{content}}</div>";
  const html = renderCampaignForRecipient({
    campaignId: campaign.id,
    bodyMarkdown: campaign.bodyMarkdown,
    templateHtml,
    recipient: { email: to, name: null },
    crmBaseUrl: CRM_BASE_URL,
  });
  const result = await sendMail({ to, subject: `[Test] ${campaign.subject}`, html });
  if (!result.ok) return c.json({ error: result.error }, 502);
  return c.json({ ok: true });
});

// POST /crm/campaigns/:id/schedule { runAt, recipients }
crmCampaigns.post("/:id/schedule", async (c) => {
  const id = c.req.param("id");
  const campaign = store.read().campaigns.find((r) => r.id === id);
  if (!campaign) return c.json({ error: "not found" }, 404);
  if (campaign.status !== "draft") {
    return c.json({ error: `cannot schedule from status "${campaign.status}"` }, 409);
  }

  let body: { runAt?: string; recipients?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }
  const runAt = body.runAt;
  if (!runAt || new Date(runAt).getTime() <= Date.now()) {
    return c.json({ error: "runAt must be a future time" }, 400);
  }
  const recipients = normalizeRecipients(body.recipients);
  if (recipients.length === 0) {
    return c.json({ error: "recipients required for scheduled send" }, 400);
  }

  const now = new Date().toISOString();
  store.update((draft) => {
    draft.scheduledJobs.push({
      id: newId("job"),
      accountLinkId: DEV_ACCOUNT_LINK_ID,
      kind: "campaign",
      refId: id,
      runAt,
      status: "pending",
      createdAt: now,
    });
    const idx = draft.campaigns.findIndex((r) => r.id === id);
    if (idx >= 0) {
      draft.campaigns[idx] = {
        ...draft.campaigns[idx]!,
        segmentJson: JSON.stringify({ recipients }),
        status: "scheduled",
        scheduledAt: runAt,
        updatedAt: now,
      };
    }
  });

  const row = store.read().campaigns.find((r) => r.id === id)!;
  return c.json(serialize(row));
});

// POST /crm/campaigns/:id/cancel-schedule
crmCampaigns.post("/:id/cancel-schedule", async (c) => {
  const id = c.req.param("id");
  const data = store.read();
  const campaign = data.campaigns.find((r) => r.id === id);
  if (!campaign) return c.json({ error: "not found" }, 404);
  if (campaign.status !== "scheduled") {
    return c.json({ error: "already sent — cannot cancel" }, 409);
  }

  const job = data.scheduledJobs.find((j) => j.refId === id);
  if (job && job.status === "pending") {
    store.update((draft) => {
      draft.scheduledJobs = draft.scheduledJobs.filter((j) => j.id !== job.id);
    });
  } else if (job) {
    return c.json({ error: "send already started; cannot cancel" }, 409);
  }

  store.update((draft) => {
    const idx = draft.campaigns.findIndex((r) => r.id === id);
    if (idx >= 0) {
      draft.campaigns[idx] = {
        ...draft.campaigns[idx]!,
        status: "draft",
        scheduledAt: null,
        updatedAt: new Date().toISOString(),
      };
    }
  });

  const row = store.read().campaigns.find((r) => r.id === id)!;
  return c.json(serialize(row));
});
