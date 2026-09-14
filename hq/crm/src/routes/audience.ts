import { Hono } from "hono";
import { DEV_ACCOUNT_LINK_ID, store } from "../db/store";
import type { AudienceDataSource, AudienceGroup, AudienceMember } from "../db/types";
import { fetchDataSourceContacts } from "../lib/audience-sync";
import { newId } from "../lib/ids";

export const crmAudience = new Hono();

function maskDataSource(ds: AudienceDataSource | null) {
  if (!ds) return undefined;
  return {
    type: ds.type,
    endpointUrl: ds.endpointUrl,
    credential: ds.credential ? "••••••" : undefined,
    credentialHeader: ds.credentialHeader,
  };
}

function toSummary(group: AudienceGroup) {
  return {
    id: group.id,
    name: group.name,
    domain: group.domain,
    createdAt: group.createdAt,
    contactCount: group.contacts.length,
    defaultFrom: group.defaultFrom ?? undefined,
    dataSource: maskDataSource(group.dataSource),
    cronEnabled: group.cronEnabled,
    cronIntervalMinutes: group.cronIntervalMinutes,
    lastSyncAt: group.lastSyncAt ?? undefined,
    lastSyncStatus: group.lastSyncStatus ?? undefined,
    lastSyncError: group.lastSyncError ?? undefined,
    lastSyncCount: group.lastSyncCount ?? undefined,
    syncHistory: group.syncHistory.slice(0, 20),
  };
}

function toContact(group: AudienceGroup, member: AudienceMember) {
  return {
    id: member.id,
    email: member.email,
    name: member.name ?? undefined,
    domain: group.domain,
    groupId: group.id,
    source: member.source,
    addedAt: member.addedAt,
  };
}

function findGroup(id: string): AudienceGroup | undefined {
  return store.read().audienceGroups.find((g) => g.id === id && g.accountLinkId === DEV_ACCOUNT_LINK_ID);
}

function mergeDataSource(
  existing: AudienceDataSource | null,
  incoming: AudienceDataSource | null | undefined,
  keepCredential: boolean,
): AudienceDataSource | null {
  if (incoming === null) return null;
  if (!incoming) return existing;
  const credential =
    incoming.credential?.trim() ||
    (keepCredential ? existing?.credential : undefined) ||
    undefined;
  return {
    type: "generic_json",
    endpointUrl: incoming.endpointUrl.trim(),
    credential,
    credentialHeader: incoming.credentialHeader?.trim() || undefined,
  };
}

export async function syncAudienceGroupAsync(
  groupId: string,
  trigger: "manual" | "cron",
): Promise<{ ok: true; totalCount: number; skippedCount: number } | { ok: false; error: string }> {
  const group = findGroup(groupId);
  if (!group) return { ok: false, error: "not found" };
  if (!group.dataSource?.endpointUrl) {
    return { ok: false, error: "group has no data source" };
  }

  const runId = newId("sync");
  const startedAt = new Date().toISOString();
  store.update((draft) => {
    const idx = draft.audienceGroups.findIndex((g) => g.id === groupId);
    if (idx < 0) return;
    draft.audienceGroups[idx]!.syncHistory.unshift({
      id: runId,
      trigger,
      status: "running",
      phase: "fetching",
      startedAt,
    });
  });

  try {
    const { contacts, skipped } = await fetchDataSourceContacts(group.dataSource);
    const now = new Date().toISOString();
    store.update((draft) => {
      const idx = draft.audienceGroups.findIndex((g) => g.id === groupId);
      if (idx < 0) return;
      const g = draft.audienceGroups[idx]!;
      const manual = g.contacts.filter((c) => c.source === "manual");
      const synced: AudienceMember[] = contacts.map((c) => ({
        id: newId("member"),
        email: c.email,
        name: c.name,
        source: "synced" as const,
        addedAt: now,
      }));
      g.contacts = [...manual, ...synced];
      g.lastSyncAt = now;
      g.lastSyncStatus = "success";
      g.lastSyncError = null;
      g.lastSyncCount = synced.length;
      const run = g.syncHistory.find((r) => r.id === runId);
      if (run) {
        run.status = "success";
        run.phase = "done";
        run.finishedAt = now;
        run.totalCount = contacts.length + skipped;
        run.skippedCount = skipped;
        run.successCount = synced.length;
      }
    });
    return { ok: true, totalCount: contacts.length + skipped, skippedCount: skipped };
  } catch (err) {
    const message = err instanceof Error ? err.message : "sync failed";
    const now = new Date().toISOString();
    store.update((draft) => {
      const idx = draft.audienceGroups.findIndex((g) => g.id === groupId);
      if (idx < 0) return;
      const g = draft.audienceGroups[idx]!;
      g.lastSyncAt = now;
      g.lastSyncStatus = "error";
      g.lastSyncError = message;
      const run = g.syncHistory.find((r) => r.id === runId);
      if (run) {
        run.status = "error";
        run.phase = "done";
        run.finishedAt = now;
        run.error = message;
      }
    });
    return { ok: false, error: message };
  }
}

// GET /crm/audience-groups
crmAudience.get("/", (c) => {
  const groups = store
    .read()
    .audienceGroups.filter((g) => g.accountLinkId === DEV_ACCOUNT_LINK_ID)
    .map(toSummary);
  return c.json({ groups });
});

// POST /crm/audience-groups/test
crmAudience.post("/test", async (c) => {
  let body: {
    endpointUrl?: string;
    credential?: string;
    credentialHeader?: string;
    groupId?: string;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }

  let dataSource: AudienceDataSource | null = null;
  if (body.groupId) {
    const group = findGroup(body.groupId);
    if (!group?.dataSource) {
      return c.json({ error: "group has no data source" }, 400);
    }
    dataSource = {
      ...group.dataSource,
      credential: body.credential?.trim() || group.dataSource.credential,
      credentialHeader: body.credentialHeader ?? group.dataSource.credentialHeader,
    };
  } else {
    const endpointUrl = body.endpointUrl?.trim();
    if (!endpointUrl) return c.json({ error: "endpointUrl is required" }, 400);
    dataSource = {
      type: "generic_json",
      endpointUrl,
      credential: body.credential?.trim(),
      credentialHeader: body.credentialHeader?.trim(),
    };
  }

  try {
    const { contacts, skipped } = await fetchDataSourceContacts(dataSource);
    return c.json({
      ok: true,
      totalCount: contacts.length + skipped,
      skippedCount: skipped,
      sampleContacts: contacts.slice(0, 5).map((c) => ({
        email: c.email,
        name: c.name ?? undefined,
      })),
    });
  } catch (err) {
    return c.json(
      { ok: false, error: err instanceof Error ? err.message : "Test failed" },
      502,
    );
  }
});

// POST /crm/audience-groups
crmAudience.post("/", async (c) => {
  let body: {
    name?: string;
    domain?: string;
    dataSource?: AudienceDataSource;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }

  const name = body.name?.trim();
  const domain = body.domain?.trim().toLowerCase();
  if (!name || !domain) {
    return c.json({ error: "name and domain are required" }, 400);
  }

  const id = newId("audience");
  const now = new Date().toISOString();
  const dataSource = body.dataSource
    ? mergeDataSource(null, body.dataSource, false)
    : null;

  store.update((draft) => {
    draft.audienceGroups.push({
      id,
      accountLinkId: DEV_ACCOUNT_LINK_ID,
      name,
      domain,
      createdAt: now,
      defaultFrom: null,
      dataSource,
      cronEnabled: false,
      cronIntervalMinutes: 60,
      lastSyncAt: null,
      lastSyncStatus: null,
      lastSyncError: null,
      lastSyncCount: null,
      syncHistory: [],
      contacts: [],
    });
  });

  if (dataSource) {
    await syncAudienceGroupAsync(id, "manual");
  }

  const group = findGroup(id)!;
  return c.json({ group: toSummary(group) }, 201);
});

// GET /crm/audience-groups/:id
crmAudience.get("/:id", (c) => {
  const group = findGroup(c.req.param("id"));
  if (!group) return c.json({ error: "not found" }, 404);
  return c.json({
    group: toSummary(group),
    contacts: group.contacts.map((m) => toContact(group, m)),
  });
});

// PATCH /crm/audience-groups/:id
crmAudience.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = findGroup(id);
  if (!existing) return c.json({ error: "not found" }, 404);

  let body: {
    name?: string;
    defaultFrom?: string | null;
    cronEnabled?: boolean;
    cronIntervalMinutes?: number;
    dataSource?: AudienceDataSource | null;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }

  const dataSourceTouched = body.dataSource !== undefined;
  store.update((draft) => {
    const idx = draft.audienceGroups.findIndex((g) => g.id === id);
    if (idx < 0) return;
    const g = draft.audienceGroups[idx]!;
    if (body.name !== undefined) g.name = body.name.trim() || g.name;
    if (body.defaultFrom !== undefined) g.defaultFrom = body.defaultFrom?.trim() || null;
    if (body.cronEnabled !== undefined) g.cronEnabled = body.cronEnabled;
    if (body.cronIntervalMinutes !== undefined) {
      g.cronIntervalMinutes = Math.max(15, Number(body.cronIntervalMinutes) || 60);
    }
    if (dataSourceTouched) {
      g.dataSource = mergeDataSource(g.dataSource, body.dataSource ?? null, true);
    }
  });

  if (dataSourceTouched && findGroup(id)?.dataSource) {
    await syncAudienceGroupAsync(id, "manual");
  }

  const group = findGroup(id)!;
  return c.json({
    group: toSummary(group),
    contacts: group.contacts.map((m) => toContact(group, m)),
  });
});

// DELETE /crm/audience-groups/:id
crmAudience.delete("/:id", (c) => {
  const id = c.req.param("id");
  const existed = Boolean(findGroup(id));
  if (!existed) return c.json({ error: "not found" }, 404);
  store.update((draft) => {
    draft.audienceGroups = draft.audienceGroups.filter((g) => g.id !== id);
  });
  return c.json({ ok: true });
});

// POST /crm/audience-groups/:id/contacts
crmAudience.post("/:id/contacts", async (c) => {
  const group = findGroup(c.req.param("id"));
  if (!group) return c.json({ error: "not found" }, 404);

  let body: { email?: string; name?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }

  const email = body.email?.trim().toLowerCase();
  if (!email?.includes("@")) {
    return c.json({ error: "a valid email is required" }, 400);
  }

  const duplicate = group.contacts.find((m) => m.email === email);
  if (duplicate) {
    return c.json({ error: "contact already exists", contactId: duplicate.id }, 409);
  }

  const member: AudienceMember = {
    id: newId("member"),
    email,
    name: body.name?.trim() || null,
    source: "manual",
    addedAt: new Date().toISOString(),
  };

  store.update((draft) => {
    const idx = draft.audienceGroups.findIndex((g) => g.id === group.id);
    if (idx >= 0) draft.audienceGroups[idx]!.contacts.push(member);
  });

  const updated = findGroup(group.id)!;
  return c.json({ contact: toContact(updated, member) }, 201);
});

// DELETE /crm/audience-groups/:id/contacts?contactId=
crmAudience.delete("/:id/contacts", (c) => {
  const group = findGroup(c.req.param("id"));
  if (!group) return c.json({ error: "not found" }, 404);

  const contactId = c.req.query("contactId")?.trim();
  if (!contactId) return c.json({ error: "contactId is required" }, 400);

  const existed = group.contacts.some((m) => m.id === contactId);
  if (!existed) return c.json({ error: "not found" }, 404);

  store.update((draft) => {
    const idx = draft.audienceGroups.findIndex((g) => g.id === group.id);
    if (idx >= 0) {
      draft.audienceGroups[idx]!.contacts = draft.audienceGroups[idx]!.contacts.filter(
        (m) => m.id !== contactId,
      );
    }
  });

  return c.json({ ok: true });
});
