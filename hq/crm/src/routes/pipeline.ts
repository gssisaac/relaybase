import { Hono } from "hono";
import { desc, eq, inArray } from "drizzle-orm";
import { db, DEV_ACCOUNT_LINK_ID } from "../db/client";
import { activities, contacts, pipelineCards } from "../db/schema";
import { newId } from "../lib/ids";

export const crmPipeline = new Hono();

const STAGES = ["lead", "contacted", "quoted", "won", "lost"] as const;
export type Stage = (typeof STAGES)[number];

// GET /crm/pipeline — all 5 stages, up to 50 cards each (P0-4)
crmPipeline.get("/", async (c) => {
  const accountContacts = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(eq(contacts.accountLinkId, DEV_ACCOUNT_LINK_ID));
  const contactIds = accountContacts.map((r) => r.id);
  if (contactIds.length === 0) {
    return c.json({ columns: STAGES.map((stage) => ({ stage, count: 0, cards: [] })) });
  }

  const cards = await db
    .select()
    .from(pipelineCards)
    .where(inArray(pipelineCards.contactId, contactIds))
    .orderBy(desc(pipelineCards.updatedAt));

  const contactById = new Map(
    (await db.select().from(contacts).where(inArray(contacts.id, contactIds))).map((r) => [
      r.id,
      r,
    ]),
  );

  const columns = STAGES.map((stage) => {
    const stageCards = cards.filter((card) => card.stage === stage);
    return {
      stage,
      count: stageCards.length,
      cards: stageCards.slice(0, 50).map((card) => {
        const contact = contactById.get(card.contactId);
        return {
          contactId: card.contactId,
          name: contact?.name ?? null,
          email: contact?.email ?? "",
          note: card.note,
          updatedAt: card.updatedAt,
        };
      }),
    };
  });

  return c.json({ columns });
});

// PATCH /crm/pipeline/:contactId { stage } or { note }
crmPipeline.patch("/:contactId", async (c) => {
  const contactId = c.req.param("contactId");
  const card = await db
    .select()
    .from(pipelineCards)
    .where(eq(pipelineCards.contactId, contactId))
    .get();
  if (!card) return c.json({ error: "not found" }, 404);

  let body: { stage?: string; note?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }

  if (body.stage && !(STAGES as readonly string[]).includes(body.stage)) {
    return c.json({ error: `stage must be one of ${STAGES.join(", ")}` }, 400);
  }

  const now = new Date().toISOString();
  await db
    .update(pipelineCards)
    .set({
      stage: body.stage ?? card.stage,
      note: body.note !== undefined ? body.note : card.note,
      updatedAt: now,
    })
    .where(eq(pipelineCards.contactId, contactId));

  if (body.stage && body.stage !== card.stage) {
    await db.insert(activities).values({
      id: newId("activity"),
      contactId,
      type: "note",
      payloadJson: JSON.stringify({ stageChange: { from: card.stage, to: body.stage } }),
      occurredAt: now,
    });
  }
  if (body.note !== undefined && body.note !== card.note) {
    await db.insert(activities).values({
      id: newId("activity"),
      contactId,
      type: "note",
      payloadJson: JSON.stringify({ note: body.note }),
      occurredAt: now,
    });
  }

  const updated = await db
    .select()
    .from(pipelineCards)
    .where(eq(pipelineCards.contactId, contactId))
    .get();
  return c.json({ contactId, stage: updated!.stage, note: updated!.note, updatedAt: updated!.updatedAt });
});
