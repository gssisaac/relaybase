import { Hono } from "hono";
import { DEV_ACCOUNT_LINK_ID, store } from "../db/store";
import type { SubscriberDataSource, SubscriberMember } from "../db/types";
import { isEmailSuppressedForGroup } from "../lib/account/suppression";
import {
  subscriberContactToApi,
  subscriberGroupToSummary,
} from "../lib/subscriber-groups/api-serialize";
import { mergeDataSource } from "../lib/subscriber-groups/data-source-merge";
import { fetchDataSourceContacts } from "../lib/subscriber-groups/data-source-sync";
import { findSubscriberGroup } from "../lib/subscriber-groups/group";
import { setSubscriberContactSendStatus } from "../lib/subscriber-groups/send-status";
import { syncSubscriberGroupAsync } from "../lib/subscriber-groups/sync";
import { newId, newToken } from "../lib/shared/ids";

export const studioSubscriberGroups = new Hono();

// GET /studio/subscriber-groups
studioSubscriberGroups.get("/", (c) => {
  const groups = store
    .read()
    .subscriberGroups.filter((g) => g.accountLinkId === DEV_ACCOUNT_LINK_ID)
    .map(subscriberGroupToSummary);
  return c.json({ groups });
});

// POST /studio/subscriber-groups/test
studioSubscriberGroups.post("/test", async (c) => {
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

  let dataSource: SubscriberDataSource | null = null;
  if (body.groupId) {
    const group = findSubscriberGroup(body.groupId);
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

// POST /studio/subscriber-groups
studioSubscriberGroups.post("/", async (c) => {
  let body: {
    name?: string;
    domain?: string;
    workerUrl?: string;
    dataSource?: SubscriberDataSource;
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

  const id = newId("subscriber");
  const now = new Date().toISOString();
  const dataSource = body.dataSource
    ? mergeDataSource(null, body.dataSource, false)
    : null;

  store.update((draft) => {
    draft.subscriberGroups.push({
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
    await syncSubscriberGroupAsync(id, "manual");
  }

  const group = findSubscriberGroup(id)!;
  return c.json({ group: subscriberGroupToSummary(group) }, 201);
});

// GET /studio/subscriber-groups/:id
studioSubscriberGroups.get("/:id", (c) => {
  const group = findSubscriberGroup(c.req.param("id"));
  if (!group) return c.json({ error: "not found" }, 404);
  return c.json({
    group: subscriberGroupToSummary(group),
    contacts: group.contacts.map((m) => subscriberContactToApi(group, m)),
  });
});

// PATCH /studio/subscriber-groups/:id
studioSubscriberGroups.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = findSubscriberGroup(id);
  if (!existing) return c.json({ error: "not found" }, 404);

  let body: {
    name?: string;
    domain?: string;
    workerUrl?: string;
    defaultFrom?: string | null;
    cronEnabled?: boolean;
    cronIntervalMinutes?: number;
    dataSource?: SubscriberDataSource | null;
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
    if (workerUrl) draft.account.workerUrl = workerUrl;
    const idx = draft.subscriberGroups.findIndex((g) => g.id === id);
    if (idx < 0) return;
    const g = draft.subscriberGroups[idx]!;
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

  if (dataSourceTouched && findSubscriberGroup(id)?.dataSource) {
    await syncSubscriberGroupAsync(id, "manual");
  }

  const group = findSubscriberGroup(id)!;
  return c.json({
    group: subscriberGroupToSummary(group),
    contacts: group.contacts.map((m) => subscriberContactToApi(group, m)),
  });
});

// DELETE /studio/subscriber-groups/:id
studioSubscriberGroups.delete("/:id", (c) => {
  const id = c.req.param("id");
  const existed = Boolean(findSubscriberGroup(id));
  if (!existed) return c.json({ error: "not found" }, 404);
  store.update((draft) => {
    draft.subscriberGroups = draft.subscriberGroups.filter((g) => g.id !== id);
  });
  return c.json({ ok: true });
});

// POST /studio/subscriber-groups/:id/contacts
studioSubscriberGroups.post("/:id/contacts", async (c) => {
  const group = findSubscriberGroup(c.req.param("id"));
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
          "This address is on the account suppression list for this subscriber group. Remove the suppression before re-adding.",
      },
      409,
    );
  }

  const addedAt = new Date().toISOString();
  const member: SubscriberMember = {
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
    const idx = draft.subscriberGroups.findIndex((g) => g.id === group.id);
    if (idx >= 0) draft.subscriberGroups[idx]!.contacts.push(member);
  });

  const updated = findSubscriberGroup(group.id)!;
  return c.json({ contact: subscriberContactToApi(updated, member) }, 201);
});

// DELETE /studio/subscriber-groups/:id/contacts?contactId=
studioSubscriberGroups.delete("/:id/contacts", (c) => {
  const group = findSubscriberGroup(c.req.param("id"));
  if (!group) return c.json({ error: "not found" }, 404);

  const contactId = c.req.query("contactId")?.trim();
  if (!contactId) return c.json({ error: "contactId is required" }, 400);

  const existed = group.contacts.some((m) => m.id === contactId);
  if (!existed) return c.json({ error: "not found" }, 404);

  store.update((draft) => {
    const idx = draft.subscriberGroups.findIndex((g) => g.id === group.id);
    if (idx >= 0) {
      draft.subscriberGroups[idx]!.contacts = draft.subscriberGroups[idx]!.contacts.filter(
        (m) => m.id !== contactId,
      );
    }
  });

  return c.json({ ok: true });
});

// PATCH /studio/subscriber-groups/:id/contacts/:contactId { sendStatus: "active" | "unsubscribed" }
studioSubscriberGroups.patch("/:id/contacts/:contactId", async (c) => {
  const group = findSubscriberGroup(c.req.param("id"));
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

  setSubscriberContactSendStatus(group.id, contactId, body.sendStatus);

  const updated = findSubscriberGroup(group.id)!;
  const member = updated.contacts.find((m) => m.id === contactId)!;
  return c.json({ contact: subscriberContactToApi(updated, member) });
});
