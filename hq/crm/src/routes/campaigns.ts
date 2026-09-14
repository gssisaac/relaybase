import { Hono } from "hono";
import { DEV_ACCOUNT_LINK_ID, store } from "../db/store";
import type { Campaign, CampaignDataSource } from "../db/types";
import {
  findAudienceGroup,
  syncCampaignSubscribersFromAudienceGroup,
} from "../lib/audience-subscribers";
import { newId } from "../lib/ids";

export const crmCampaigns = new Hono();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function maskDataSource(ds: CampaignDataSource | null | undefined) {
  if (!ds) return undefined;
  return {
    type: ds.type,
    endpointUrl: ds.endpointUrl,
    credential: ds.credential ? "••••••" : undefined,
    credentialHeader: ds.credentialHeader,
    cronEnabled: ds.cronEnabled ?? false,
    cronIntervalMinutes: ds.cronIntervalMinutes ?? 60,
    lastSyncAt: ds.lastSyncAt ?? undefined,
    lastSyncStatus: ds.lastSyncStatus ?? undefined,
    lastSyncError: ds.lastSyncError ?? undefined,
    lastSyncCount: ds.lastSyncCount ?? undefined,
  };
}

function serialize(row: Campaign, counts: { subscribers: number; broadcasts: number }) {
  const group = row.audienceGroupId ? findAudienceGroup(row.audienceGroupId) : undefined;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? null,
    audienceGroupId: row.audienceGroupId || null,
    audienceGroupName: group?.name ?? null,
    audienceGroupDomain: group?.domain ?? null,
    audienceContactCount: group?.contacts.length ?? null,
    fromName: row.fromName ?? null,
    fromEmail: row.fromEmail ?? null,
    replyTo: row.replyTo ?? null,
    defaultTemplateId: row.defaultTemplateId ?? null,
    status: row.status,
    dataSource: maskDataSource(row.dataSource),
    subscriberCount: counts.subscribers,
    broadcastCount: counts.broadcasts,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function countsFor(campaignId: string) {
  const data = store.read();
  return {
    subscribers: data.subscribers.filter(
      (s) => s.campaignId === campaignId && s.status === "subscribed",
    ).length,
    broadcasts: data.broadcasts.filter((b) => b.campaignId === campaignId).length,
  };
}

function mergeDataSource(
  existing: CampaignDataSource | null | undefined,
  incoming: Partial<CampaignDataSource> | null | undefined,
  keepCredential: boolean,
): CampaignDataSource | null {
  if (incoming === null) return null;
  if (!incoming) return existing ?? null;
  const endpointUrl = (incoming.endpointUrl ?? existing?.endpointUrl ?? "").trim();
  if (!endpointUrl) return existing ?? null;
  const credential =
    incoming.credential?.trim() || (keepCredential ? existing?.credential : undefined) || undefined;
  return {
    type: "generic_json",
    endpointUrl,
    credential,
    credentialHeader: incoming.credentialHeader?.trim() || existing?.credentialHeader || undefined,
    cronEnabled: incoming.cronEnabled ?? existing?.cronEnabled ?? false,
    cronIntervalMinutes: Math.max(15, incoming.cronIntervalMinutes ?? existing?.cronIntervalMinutes ?? 60),
    lastSyncAt: existing?.lastSyncAt ?? null,
    lastSyncStatus: existing?.lastSyncStatus ?? null,
    lastSyncError: existing?.lastSyncError ?? null,
    lastSyncCount: existing?.lastSyncCount ?? null,
  };
}

// GET /crm/campaigns
crmCampaigns.get("/", async (c) => {
  const data = store.read();
  const rows = data.campaigns
    .filter((row) => row.accountLinkId === DEV_ACCOUNT_LINK_ID)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return c.json({ campaigns: rows.map((row) => serialize(row, countsFor(row.id))) });
});

// POST /crm/campaigns { name, audienceGroupId, slug?, fromName?, fromEmail?, replyTo?, defaultTemplateId? }
crmCampaigns.post("/", async (c) => {
  let body: {
    name?: string;
    audienceGroupId?: string;
    slug?: string;
    fromName?: string;
    fromEmail?: string;
    replyTo?: string;
    defaultTemplateId?: string;
  } = {};
  try {
    body = await c.req.json();
  } catch {
    /* empty body */
  }

  const name = body.name?.trim();
  if (!name) {
    return c.json({ error: "Campaign name is required" }, 400);
  }
  const audienceGroupId = body.audienceGroupId?.trim();
  if (!audienceGroupId) {
    return c.json({ error: "Select an audience group for this campaign" }, 400);
  }
  const audienceGroup = findAudienceGroup(audienceGroupId);
  if (!audienceGroup) {
    return c.json({ error: "Audience group not found" }, 404);
  }
  if (body.fromEmail && !EMAIL_RE.test(body.fromEmail.trim())) {
    return c.json({ error: "Enter a valid sender email (e.g., newsletter@yourdomain.com)" }, 400);
  }

  const data = store.read();
  const baseSlug = slugify(body.slug?.trim() || name) || newId("campaign").slice(0, 12);
  let slug = baseSlug;
  let suffix = 2;
  while (
    data.campaigns.some(
      (row) => row.accountLinkId === DEV_ACCOUNT_LINK_ID && row.slug === slug,
    )
  ) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
  if (
    data.campaigns.some(
      (row) =>
        row.accountLinkId === DEV_ACCOUNT_LINK_ID &&
        row.name.trim().toLowerCase() === name.toLowerCase(),
    )
  ) {
    return c.json(
      { error: "A campaign with this identifier already exists in this account" },
      409,
    );
  }

  const id = newId("campaign");
  const now = new Date().toISOString();
  let created: Campaign | null = null;
  store.update((draft) => {
    created = {
      id,
      accountLinkId: DEV_ACCOUNT_LINK_ID,
      name,
      slug,
      description: null,
      audienceGroupId,
      fromName: body.fromName?.trim() || null,
      fromEmail: body.fromEmail?.trim() || audienceGroup.defaultFrom || null,
      replyTo: body.replyTo?.trim() || null,
      defaultTemplateId: body.defaultTemplateId || null,
      status: "active",
      dataSource: null,
      createdAt: now,
      updatedAt: now,
    };
    draft.campaigns.push(created);
  });

  syncCampaignSubscribersFromAudienceGroup(created!.id, audienceGroupId);

  return c.json(serialize(created!, countsFor(created!.id)), 201);
});

// GET /crm/campaigns/:id
crmCampaigns.get("/:id", async (c) => {
  const row = store.read().campaigns.find((r) => r.id === c.req.param("id"));
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(serialize(row, countsFor(row.id)));
});

// PATCH /crm/campaigns/:id — settings (UC-C2), status toggle for archive/unarchive (UC-C3)
crmCampaigns.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const data = store.read();
  const existing = data.campaigns.find((r) => r.id === id);
  if (!existing) return c.json({ error: "not found" }, 404);

  let body: {
    name?: string;
    slug?: string;
    description?: string | null;
    fromName?: string | null;
    fromEmail?: string | null;
    replyTo?: string | null;
    defaultTemplateId?: string | null;
    status?: "active" | "archived";
    dataSource?: Partial<CampaignDataSource> | null;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }

  if (body.fromEmail && !EMAIL_RE.test(body.fromEmail.trim())) {
    return c.json({ error: "Enter a valid sender email (e.g., newsletter@yourdomain.com)" }, 400);
  }

  if (body.status === "archived" && existing.status !== "archived") {
    const hasSending = data.broadcasts.some(
      (b) => b.campaignId === id && b.status === "sending",
    );
    if (hasSending) {
      const sending = data.broadcasts.find((b) => b.campaignId === id && b.status === "sending");
      return c.json(
        {
          error: `Cannot archive campaign while Broadcast '${sending?.subject || "Untitled"}' is currently sending. Wait for send completion or abort the broadcast first.`,
        },
        409,
      );
    }
  }

  const dataSourceTouched = body.dataSource !== undefined;
  let updated: Campaign | null = null;
  const now = new Date().toISOString();
  store.update((draft) => {
    const idx = draft.campaigns.findIndex((r) => r.id === id);
    if (idx < 0) return;
    const prev = draft.campaigns[idx]!;
    draft.campaigns[idx] = {
      ...prev,
      name: body.name?.trim() || prev.name,
      slug: body.slug?.trim() ? slugify(body.slug) : prev.slug,
      description: body.description !== undefined ? body.description : prev.description,
      fromName: body.fromName !== undefined ? body.fromName?.trim() || null : prev.fromName,
      fromEmail: body.fromEmail !== undefined ? body.fromEmail?.trim() || null : prev.fromEmail,
      replyTo: body.replyTo !== undefined ? body.replyTo?.trim() || null : prev.replyTo,
      defaultTemplateId:
        body.defaultTemplateId !== undefined ? body.defaultTemplateId : prev.defaultTemplateId,
      status: body.status ?? prev.status,
      dataSource: dataSourceTouched
        ? mergeDataSource(prev.dataSource, body.dataSource, true)
        : prev.dataSource,
      updatedAt: now,
    };
    updated = draft.campaigns[idx]!;

    if (body.status === "archived" && prev.status !== "archived") {
      const broadcastIds = draft.broadcasts
        .filter((b) => b.campaignId === id && b.status === "scheduled")
        .map((b) => b.id);
      draft.broadcasts = draft.broadcasts.map((b) =>
        broadcastIds.includes(b.id) ? { ...b, status: "draft", scheduledAt: null, updatedAt: now } : b,
      );
      draft.scheduledJobs = draft.scheduledJobs.filter(
        (j) => !(j.kind === "broadcast" && broadcastIds.includes(j.refId) && j.status === "pending"),
      );
    }
  });

  return c.json(serialize(updated!, countsFor(id)));
});
