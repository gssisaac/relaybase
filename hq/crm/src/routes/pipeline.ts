import { Hono } from "hono";
import { store } from "../db/store";
import type { PipelineCard } from "../db/types";
import { newId } from "../lib/ids";

export const crmPipeline = new Hono();

const STAGES = ["lead", "contacted", "quoted", "won", "lost"] as const;
export type Stage = (typeof STAGES)[number];

// GET /crm/pipeline — cards keyed by audience member email (Worker is source of truth for audience)
crmPipeline.get("/", async (c) => {
  const data = store.read();
  const cards = data.pipelineCards.filter((card) => card.stage);

  const columns = STAGES.map((stage) => {
    const stageCards = cards.filter((card) => card.stage === stage);
    return {
      stage,
      count: stageCards.length,
      cards: stageCards.slice(0, 50).map((card) => ({
        memberEmail: card.memberEmail,
        name: card.memberName,
        email: card.memberEmail,
        note: card.note,
        updatedAt: card.updatedAt,
      })),
    };
  });

  return c.json({ columns });
});

// PATCH /crm/pipeline/:memberEmail { stage?, note?, name? } — upserts a card for an audience member
crmPipeline.patch("/:memberEmail", async (c) => {
  let memberEmail = c.req.param("memberEmail");
  try {
    memberEmail = decodeURIComponent(memberEmail).trim().toLowerCase();
  } catch {
    return c.json({ error: "invalid member email" }, 400);
  }
  if (!memberEmail.includes("@")) {
    return c.json({ error: "invalid member email" }, 400);
  }

  let body: { stage?: string; note?: string; name?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }

  if (body.stage && !(STAGES as readonly string[]).includes(body.stage)) {
    return c.json({ error: `stage must be one of ${STAGES.join(", ")}` }, 400);
  }

  const now = new Date().toISOString();
  let fromStage: string | null = null;
  let updatedCard: PipelineCard | null = null;

  store.update((draft) => {
    const idx = draft.pipelineCards.findIndex((card) => card.memberEmail === memberEmail);
    if (idx >= 0) {
      fromStage = draft.pipelineCards[idx]!.stage;
      const prev = draft.pipelineCards[idx]!;
      draft.pipelineCards[idx] = {
        ...prev,
        stage: body.stage ?? prev.stage,
        note: body.note !== undefined ? body.note : prev.note,
        memberName: body.name !== undefined ? body.name.trim() || null : prev.memberName,
        updatedAt: now,
      };
      updatedCard = draft.pipelineCards[idx]!;
    } else {
      draft.pipelineCards.push({
        id: newId("card"),
        memberEmail,
        memberName: body.name?.trim() || null,
        stage: body.stage ?? "lead",
        note: body.note ?? null,
        updatedAt: now,
      });
      updatedCard = draft.pipelineCards[draft.pipelineCards.length - 1]!;
    }

    if (body.stage && fromStage && body.stage !== fromStage) {
      draft.activities.push({
        id: newId("activity"),
        memberEmail,
        type: "note",
        payload: { stageChange: { from: fromStage, to: body.stage } },
        occurredAt: now,
      });
    } else if (body.note !== undefined) {
      draft.activities.push({
        id: newId("activity"),
        memberEmail,
        type: "note",
        payload: { note: body.note },
        occurredAt: now,
      });
    }
  });

  return c.json({
    memberEmail,
    stage: updatedCard!.stage,
    note: updatedCard!.note,
    updatedAt: updatedCard!.updatedAt,
  });
});
