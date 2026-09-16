import { Hono } from "hono";
import { DEV_ACCOUNT_LINK_ID, store } from "../db/store";
import type { AudienceDataSource, AudienceMember } from "../db/types";
import { isEmailSuppressedForGroup } from "../lib/account/suppression";
import {
  audienceContactToApi,
  audienceGroupToSummary,
} from "../lib/audience-groups/api-serialize";
import { mergeDataSource } from "../lib/audience-groups/data-source-merge";
import { fetchDataSourceContacts } from "../lib/audience-groups/data-source-sync";
import { findAudienceGroup } from "../lib/audience-groups/group";
import { setAudienceContactSendStatus } from "../lib/audience-groups/send-status";
import { syncAudienceGroupAsync } from "../lib/audience-groups/sync";
import { newId, newToken } from "../lib/shared/ids";

export const studioAudience = new Hono();

// GET /studio/audience-groups
studioAudience.get("/", (c) => {
  const groups = store
    .read()
    .audienceGroups.filter((g) => g.accountLinkId === DEV_ACCOUNT_LINK_ID)
    .map(audienceGroupToSummary);
  return c.json({ groups });
});

// POST /studio/audience-groups/test
studioAudience.post("/test", async (c) => {
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
    const group = findAudienceGroup(body.groupId);
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

// POST /studio/audience-groups
studioAudience.post("/", async (c) => {
  let body: {
    name?: string;
    domain?: string;
    workerUrl?: string;
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

  const workerUrl = body.workerUrl?.trim().replace(/\/$/, "") || null;
  store.update((draft) => {
    draft.account.domain = domain;
    if (workerUrl) draft.account.workerUrl = workerUrl;
  });

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

  const group = findAudienceGroup(id)!;
  return c.json({ group: audienceGroupToSummary(group) }, 201);
});

// GET /studio/audience-groups/:id
studioAudience.get("/:id", (c) => {
  const group = findAudienceGroup(c.req.param("id"));
  if (!group) return c.json({ error: "not found" }, 404);
  return c.json({
    group: audienceGroupToSummary(group),
    contacts: group.contacts.map((m) => audienceContactToApi(group, m)),
  });
});

// PATCH /studio/audience-groups/:id
studioAudience.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = findAudienceGroup(id);
  if (!existing) return c.json({ error: "not found" }, 404);

  let body: {
    name?: string;
    domain?: string;
    workerUrl?: string;
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

  const domainPatch = body.domain?.trim().toLowerCase();
  if (domainPatch !== undefined && !domainPatch) {
    return c.json({ error: "Select a sending domain" }, 400);
  }

  const workerUrl = body.workerUrl?.trim().replace(/\/$/, "") || null;
  const activeDomain = domainPatch ?? existing.domain;
  if (body.defaultFrom !== undefined) {
    const nextFrom = body.defaultFrom?.trim() || null;
    if (nextFrom && !nextFrom.toLowerCase().endsWith(`@${activeDomain}`)) {
      return c.json({ error: "Default sender must be an address on the selected domain" }, 400);
    }
  }

  const dataSourceTouched = body.dataSource !== undefined;
  store.update((draft) => {
    if (domainPatch) {
      draft.account.domain = domainPatch;
      if (workerUrl) draft.account.workerUrl = workerUrl;
    }
    const idx = draft.audienceGroups.findIndex((g) => g.id === id);
    if (idx < 0) return;
    const g = draft.audienceGroups[idx]!;
    if (body.name !== undefined) g.name = body.name.trim() || g.name;
    if (domainPatch !== undefined && domainPatch !== g.domain) {
      g.domain = domainPatch;
      const from = g.defaultFrom?.trim().toLowerCase();
      if (from && !from.endsWith(`@${domainPatch}`)) {
        g.defaultFrom = null;
      }
    }
    if (body.defaultFrom !== undefined) {
      g.defaultFrom = body.defaultFrom?.trim() || null;
    }
    if (body.cronEnabled !== undefined) g.cronEnabled = body.cronEnabled;
    if (body.cronIntervalMinutes !== undefined) {
      g.cronIntervalMinutes = Math.max(15, Number(body.cronIntervalMinutes) || 60);
    }
    if (dataSourceTouched) {
      g.dataSource = mergeDataSource(g.dataSource, body.dataSource ?? null, true);
    }
  });

  if (dataSourceTouched && findAudienceGroup(id)?.dataSource) {
    await syncAudienceGroupAsync(id, "manual");
  }

  const group = findAudienceGroup(id)!;
  return c.json({
    group: audienceGroupToSummary(group),
    contacts: group.contacts.map((m) => audienceContactToApi(group, m)),
  });
});

// DELETE /studio/audience-groups/:id
studioAudience.delete("/:id", (c) => {
  const id = c.req.param("id");
  const existed = Boolean(findAudienceGroup(id));
  if (!existed) return c.json({ error: "not found" }, 404);
  store.update((draft) => {
    draft.audienceGroups = draft.audienceGroups.filter((g) => g.id !== id);
  });
  return c.json({ ok: true });
});

// POST /studio/audience-groups/:id/contacts
studioAudience.post("/:id/contacts", async (c) => {
  const group = findAudienceGroup(c.req.param("id"));
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

  if (isEmailSuppressedForGroup(email, group.id, group.accountLinkId)) {
    return c.json(
      {
        error:
          "This address is on the account suppression list for this audience. Remove the suppression before re-adding.",
      },
      409,
    );
  }

  const addedAt = new Date().toISOString();
  const member: AudienceMember = {
    id: newId("member"),
    email,
    name: body.name?.trim() || null,
    source: "manual",
    addedAt,
    sendStatus: "active",
    unsubscribedAt: null,
    unsubscribeToken: newToken(),
    consentSource: "manual",
    consentedAt: addedAt,
  };

  store.update((draft) => {
    const idx = draft.audienceGroups.findIndex((g) => g.id === group.id);
    if (idx >= 0) draft.audienceGroups[idx]!.contacts.push(member);
  });

  const updated = findAudienceGroup(group.id)!;
  return c.json({ contact: audienceContactToApi(updated, member) }, 201);
});

// DELETE /studio/audience-groups/:id/contacts?contactId=
studioAudience.delete("/:id/contacts", (c) => {
  const group = findAudienceGroup(c.req.param("id"));
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

// PATCH /studio/audience-groups/:id/contacts/:contactId { sendStatus: "active" | "unsubscribed" }
studioAudience.patch("/:id/contacts/:contactId", async (c) => {
  const group = findAudienceGroup(c.req.param("id"));
  if (!group) return c.json({ error: "not found" }, 404);

  const contactId = c.req.param("contactId")!.trim();
  const contact = group.contacts.find((m) => m.id === contactId);
  if (!contact) return c.json({ error: "not found" }, 404);

  let body: { sendStatus?: "active" | "unsubscribed" };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }
  if (body.sendStatus !== "active" && body.sendStatus !== "unsubscribed") {
    return c.json({ error: "sendStatus must be 'active' or 'unsubscribed'" }, 400);
  }

  setAudienceContactSendStatus(group.id, contactId, body.sendStatus);

  const updated = findAudienceGroup(group.id)!;
  const member = updated.contacts.find((m) => m.id === contactId)!;
  return c.json({ contact: audienceContactToApi(updated, member) });
});
