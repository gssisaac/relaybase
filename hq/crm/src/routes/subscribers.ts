import { Hono } from "hono";
import { DEV_ACCOUNT_LINK_ID, store } from "../db/store";
import type { Subscriber } from "../db/types";
import { fetchDataSourceContacts } from "../lib/data-source-sync";
import { newId, newToken } from "../lib/ids";

export const crmSubscribers = new Hono();

const MAX_IMPORT_ROWS = 5000;

function serialize(row: Subscriber) {
  return {
    id: row.id,
    campaignId: row.campaignId,
    email: row.email,
    name: row.name ?? null,
    status: row.status,
    source: row.source,
    unsubscribedAt: row.unsubscribedAt ?? null,
    bouncedAt: row.bouncedAt ?? null,
    bounceReason: row.bounceReason ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function findCampaign(campaignId: string) {
  return store.read().campaigns.find((c) => c.id === campaignId && c.accountLinkId === DEV_ACCOUNT_LINK_ID);
}

export function isSuppressed(email: string): boolean {
  return store.read().accountSuppressions.some((s) => s.email === email);
}

// GET /crm/campaigns/:campaignId/subscribers?status=&q=
crmSubscribers.get("/", (c) => {
  const campaignId = c.req.param("campaignId")!;
  if (!findCampaign(campaignId)) return c.json({ error: "not found" }, 404);

  const statusFilter = c.req.query("status");
  const q = c.req.query("q")?.trim().toLowerCase();

  let rows = store.read().subscribers.filter((s) => s.campaignId === campaignId);
  if (statusFilter) rows = rows.filter((s) => s.status === statusFilter);
  if (q) {
    rows = rows.filter(
      (s) => s.email.includes(q) || (s.name ?? "").toLowerCase().includes(q),
    );
  }
  rows = rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return c.json({ subscribers: rows.map(serialize) });
});

// POST /crm/campaigns/:campaignId/subscribers { email, name?, resubscribe? }
crmSubscribers.post("/", async (c) => {
  const campaignId = c.req.param("campaignId")!;
  const campaign = findCampaign(campaignId);
  if (!campaign) return c.json({ error: "not found" }, 404);

  let body: { email?: string; name?: string; resubscribe?: boolean };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }

  const email = body.email?.trim().toLowerCase();
  if (!email?.includes("@")) {
    return c.json({ error: "a valid email is required" }, 400);
  }

  if (isSuppressed(email)) {
    return c.json(
      {
        error: `Cannot add ${email}: This address hard-bounced previously or is globally suppressed across your domain.`,
        suppressed: true,
      },
      409,
    );
  }

  const data = store.read();
  const existing = data.subscribers.find((s) => s.campaignId === campaignId && s.email === email);

  if (existing?.status === "subscribed") {
    return c.json(
      { error: `${email} is already subscribed to this campaign`, subscriberId: existing.id },
      409,
    );
  }

  if (existing?.status === "unsubscribed" && !body.resubscribe) {
    return c.json(
      {
        error: `${email} previously unsubscribed. Manually resubscribing requires explicit recipient consent.`,
        requiresResubscribeConfirmation: true,
        unsubscribedAt: existing.unsubscribedAt,
        subscriberId: existing.id,
      },
      409,
    );
  }

  const now = new Date().toISOString();
  let result: Subscriber | null = null;

  store.update((draft) => {
    const idx = draft.subscribers.findIndex((s) => s.campaignId === campaignId && s.email === email);
    if (idx >= 0) {
      draft.subscribers[idx] = {
        ...draft.subscribers[idx]!,
        status: "subscribed",
        name: body.name?.trim() || draft.subscribers[idx]!.name,
        unsubscribedAt: null,
        updatedAt: now,
      };
      result = draft.subscribers[idx]!;
    } else {
      const created: Subscriber = {
        id: newId("subscriber"),
        accountLinkId: DEV_ACCOUNT_LINK_ID,
        campaignId,
        email,
        name: body.name?.trim() || null,
        status: "subscribed",
        source: "manual",
        unsubscribeToken: newToken(),
        unsubscribedAt: null,
        bouncedAt: null,
        bounceReason: null,
        createdAt: now,
        updatedAt: now,
      };
      draft.subscribers.push(created);
      result = created;
    }
  });

  return c.json(serialize(result!), 201);
});

// POST /crm/campaigns/:campaignId/subscribers/import { rows: {email,name?}[] }
crmSubscribers.post("/import", async (c) => {
  const campaignId = c.req.param("campaignId")!;
  if (!findCampaign(campaignId)) return c.json({ error: "not found" }, 404);

  let body: { rows?: Array<{ email?: string; name?: string }> };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }

  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) {
    return c.json({ error: "Missing required 'email' column header. Check your CSV format." }, 400);
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    return c.json(
      {
        error: `File contains ${rows.length} rows. Maximum synchronous import limit is ${MAX_IMPORT_ROWS} rows. Please split the file.`,
      },
      400,
    );
  }

  const result = upsertSubscribers(campaignId, rows, "csv");
  return c.json(result);
});

// POST /crm/campaigns/:campaignId/subscribers/sync — pull from configured data source
crmSubscribers.post("/sync", async (c) => {
  const campaignId = c.req.param("campaignId")!;
  const campaign = findCampaign(campaignId);
  if (!campaign) return c.json({ error: "not found" }, 404);
  if (!campaign.dataSource?.endpointUrl) {
    return c.json({ error: "campaign has no data source configured" }, 400);
  }

  try {
    const { contacts, skipped } = await fetchDataSourceContacts(campaign.dataSource);
    const result = upsertSubscribers(campaignId, contacts, "sync");
    const now = new Date().toISOString();
    store.update((draft) => {
      const idx = draft.campaigns.findIndex((r) => r.id === campaignId);
      if (idx < 0 || !draft.campaigns[idx]!.dataSource) return;
      draft.campaigns[idx] = {
        ...draft.campaigns[idx]!,
        dataSource: {
          ...draft.campaigns[idx]!.dataSource!,
          lastSyncAt: now,
          lastSyncStatus: "success",
          lastSyncError: null,
          lastSyncCount: result.added + result.updated,
        },
        updatedAt: now,
      };
    });
    return c.json({ ...result, skipped: result.skipped + skipped });
  } catch (err) {
    const message = err instanceof Error ? err.message : "sync failed";
    const now = new Date().toISOString();
    store.update((draft) => {
      const idx = draft.campaigns.findIndex((r) => r.id === campaignId);
      if (idx < 0 || !draft.campaigns[idx]!.dataSource) return;
      draft.campaigns[idx] = {
        ...draft.campaigns[idx]!,
        dataSource: {
          ...draft.campaigns[idx]!.dataSource!,
          lastSyncAt: now,
          lastSyncStatus: "error",
          lastSyncError: message,
        },
        updatedAt: now,
      };
    });
    return c.json({ ok: false, error: message }, 502);
  }
});

/** Upsert rule (UC-S2): unsubscribed/bounced subscribers are never reactivated by import/sync. */
function upsertSubscribers(
  campaignId: string,
  rows: Array<{ email?: string; name?: string | null }>,
  source: "csv" | "sync",
): { added: number; updated: number; skipped: number } {
  let added = 0;
  let updated = 0;
  let skipped = 0;
  const now = new Date().toISOString();

  store.update((draft) => {
    const seen = new Set<string>();
    for (const row of rows) {
      const email = String(row.email ?? "").trim().toLowerCase();
      if (!email.includes("@") || seen.has(email)) {
        skipped += 1;
        continue;
      }
      seen.add(email);
      const name = row.name?.trim() || null;

      const idx = draft.subscribers.findIndex(
        (s) => s.campaignId === campaignId && s.email === email,
      );
      if (idx < 0) {
        draft.subscribers.push({
          id: newId("subscriber"),
          accountLinkId: DEV_ACCOUNT_LINK_ID,
          campaignId,
          email,
          name,
          status: "subscribed",
          source,
          unsubscribeToken: newToken(),
          unsubscribedAt: null,
          bouncedAt: null,
          bounceReason: null,
          createdAt: now,
          updatedAt: now,
        });
        added += 1;
        continue;
      }

      const existing = draft.subscribers[idx]!;
      if (existing.status === "unsubscribed" || existing.status === "bounced") {
        skipped += 1;
        continue;
      }
      draft.subscribers[idx] = {
        ...existing,
        name: name ?? existing.name,
        updatedAt: now,
      };
      updated += 1;
    }
  });

  return { added, updated, skipped };
}

// DELETE /crm/campaigns/:campaignId/subscribers/:subscriberId
crmSubscribers.delete("/:subscriberId", (c) => {
  const campaignId = c.req.param("campaignId")!;
  const subscriberId = c.req.param("subscriberId")!;
  const existed = store
    .read()
    .subscribers.some((s) => s.id === subscriberId && s.campaignId === campaignId);
  if (!existed) return c.json({ error: "not found" }, 404);

  store.update((draft) => {
    draft.subscribers = draft.subscribers.filter((s) => s.id !== subscriberId);
  });
  return c.json({ ok: true });
});

// PATCH /crm/campaigns/:campaignId/subscribers/:subscriberId { status: "unsubscribed" | "subscribed" }
crmSubscribers.patch("/:subscriberId", async (c) => {
  const campaignId = c.req.param("campaignId")!;
  const subscriberId = c.req.param("subscriberId")!;
  const existing = store
    .read()
    .subscribers.find((s) => s.id === subscriberId && s.campaignId === campaignId);
  if (!existing) return c.json({ error: "not found" }, 404);

  let body: { status?: "subscribed" | "unsubscribed" };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }
  if (body.status !== "subscribed" && body.status !== "unsubscribed") {
    return c.json({ error: "status must be 'subscribed' or 'unsubscribed'" }, 400);
  }

  const now = new Date().toISOString();
  let updated: Subscriber | null = null;
  store.update((draft) => {
    const idx = draft.subscribers.findIndex((s) => s.id === subscriberId);
    if (idx < 0) return;
    draft.subscribers[idx] = {
      ...draft.subscribers[idx]!,
      status: body.status!,
      unsubscribedAt: body.status === "unsubscribed" ? now : null,
      updatedAt: now,
    };
    updated = draft.subscribers[idx]!;
  });

  return c.json(serialize(updated!));
});
