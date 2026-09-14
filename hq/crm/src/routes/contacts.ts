import { Hono } from "hono";
import { and, desc, eq, like, lt, or } from "drizzle-orm";
import { db, DEV_ACCOUNT_LINK_ID } from "../db/client";
import { activities, contacts, pipelineCards } from "../db/schema";
import { newId } from "../lib/ids";

export const crmContacts = new Hono();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseTags(json: string): string[] {
  try {
    const value = JSON.parse(json);
    return Array.isArray(value) ? value.filter((t) => typeof t === "string") : [];
  } catch {
    return [];
  }
}

function serializeContact(row: typeof contacts.$inferSelect) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    status: row.status,
    source: row.source,
    tags: parseTags(row.tagsJson),
    createdAt: row.createdAt,
    lastActivityAt: row.lastActivityAt,
    lastReplyAt: row.lastReplyAt,
    followupSnoozed: Boolean(row.followupSnoozed),
  };
}

// GET /crm/contacts?search=&tag=&status=&cursor=&limit=
crmContacts.get("/", async (c) => {
  const search = c.req.query("search")?.trim().toLowerCase();
  const tag = c.req.query("tag")?.trim();
  const status = c.req.query("status")?.trim();
  const cursor = c.req.query("cursor");
  const limit = Math.min(Number(c.req.query("limit") ?? "50") || 50, 200);

  const conditions = [eq(contacts.accountLinkId, DEV_ACCOUNT_LINK_ID)];
  if (search) {
    conditions.push(
      or(like(contacts.email, `%${search}%`), like(contacts.name, `%${search}%`))!,
    );
  }
  if (status) conditions.push(eq(contacts.status, status));
  if (cursor) conditions.push(lt(contacts.createdAt, cursor));

  const rows = await db
    .select()
    .from(contacts)
    .where(and(...conditions))
    .orderBy(desc(contacts.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const filtered = tag
    ? page.filter((r) => parseTags(r.tagsJson).includes(tag))
    : page;

  return c.json({
    contacts: filtered.map(serializeContact),
    nextCursor: hasMore ? page[page.length - 1]!.createdAt : null,
  });
});

// GET /crm/contacts/followup — P0-3 awaiting-reply list
crmContacts.get("/followup", async (c) => {
  const rows = await db
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.accountLinkId, DEV_ACCOUNT_LINK_ID),
        eq(contacts.followupSnoozed, 0),
      ),
    )
    .orderBy(desc(contacts.lastActivityAt));

  const thresholdDays = 3;
  const cutoff = Date.now() - thresholdDays * 24 * 60 * 60 * 1000;

  const awaiting = rows.filter((row) => {
    if (!row.lastActivityAt) return false;
    const lastActivity = new Date(row.lastActivityAt).getTime();
    const lastReply = row.lastReplyAt ? new Date(row.lastReplyAt).getTime() : 0;
    return lastActivity > lastReply && lastActivity < cutoff;
  });

  return c.json({ contacts: awaiting.map(serializeContact), thresholdDays });
});

// POST /crm/contacts { email, name?, tags?, status? }
crmContacts.post("/", async (c) => {
  let body: { email?: string; name?: string; tags?: string[]; status?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return c.json({ error: "a valid email is required" }, 400);
  }

  const existing = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.accountLinkId, DEV_ACCOUNT_LINK_ID), eq(contacts.email, email)))
    .get();
  if (existing) {
    return c.json({ error: "contact already exists", contactId: existing.id }, 409);
  }

  const id = newId("contact");
  const now = new Date().toISOString();
  await db.insert(contacts).values({
    id,
    accountLinkId: DEV_ACCOUNT_LINK_ID,
    email,
    name: body.name?.trim() || null,
    status: body.status ?? "lead",
    source: "manual",
    tagsJson: JSON.stringify(body.tags?.filter((t) => typeof t === "string") ?? []),
    createdAt: now,
  });
  // Every Contact gets a pipeline card immediately (P0-4) — avoids a lazy-create branch.
  await db.insert(pipelineCards).values({
    id: newId("card"),
    contactId: id,
    stage: "lead",
    updatedAt: now,
  });

  const row = await db.select().from(contacts).where(eq(contacts.id, id)).get();
  return c.json(serializeContact(row!), 201);
});

// GET /crm/contacts/:id
crmContacts.get("/:id", async (c) => {
  const id = c.req.param("id");
  const row = await db.select().from(contacts).where(eq(contacts.id, id)).get();
  if (!row) return c.json({ error: "not found" }, 404);

  const timeline = await db
    .select()
    .from(activities)
    .where(eq(activities.contactId, id))
    .orderBy(desc(activities.occurredAt))
    .limit(50);

  return c.json({
    contact: serializeContact(row),
    activities: timeline.map((a) => ({
      id: a.id,
      type: a.type,
      payload: a.payloadJson ? JSON.parse(a.payloadJson) : null,
      occurredAt: a.occurredAt,
    })),
  });
});

// PATCH /crm/contacts/:id
crmContacts.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await db.select().from(contacts).where(eq(contacts.id, id)).get();
  if (!existing) return c.json({ error: "not found" }, 404);

  let body: {
    name?: string;
    tags?: string[];
    status?: string;
    followupSnoozed?: boolean;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }

  await db
    .update(contacts)
    .set({
      name: body.name !== undefined ? body.name.trim() || null : undefined,
      tagsJson: body.tags ? JSON.stringify(body.tags.filter((t) => typeof t === "string")) : undefined,
      status: body.status,
      followupSnoozed:
        body.followupSnoozed !== undefined ? (body.followupSnoozed ? 1 : 0) : undefined,
    })
    .where(eq(contacts.id, id));

  const row = await db.select().from(contacts).where(eq(contacts.id, id)).get();
  return c.json(serializeContact(row!));
});

// DELETE /crm/contacts/:id — hard delete + cascade (P0-1 UC-8)
crmContacts.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await db.select({ id: contacts.id }).from(contacts).where(eq(contacts.id, id)).get();
  if (!existing) return c.json({ error: "not found" }, 404);

  await db.delete(activities).where(eq(activities.contactId, id));
  await db.delete(pipelineCards).where(eq(pipelineCards.contactId, id));
  await db.delete(contacts).where(eq(contacts.id, id));

  return c.json({ ok: true });
});
