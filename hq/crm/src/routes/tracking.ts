import { Hono } from "hono";
import { store } from "../db/store";
import { emailFromMemberKey } from "../lib/member-key";
import { newId } from "../lib/ids";

export const crmTracking = new Hono();

/** 1x1 transparent GIF (P0-2). */
const PIXEL_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7",
  "base64",
);

function recordEvent(input: {
  campaignId: string;
  memberKey: string;
  type: "open" | "click";
  url?: string;
}) {
  const email = emailFromMemberKey(input.memberKey);
  if (!email) return;
  try {
    store.update((draft) => {
      draft.trackingEvents.push({
        id: newId("track"),
        campaignId: input.campaignId,
        memberEmail: email,
        type: input.type,
        url: input.url ?? null,
        occurredAt: new Date().toISOString(),
      });
    });
  } catch (err) {
    console.error("[crm-tracking] failed to record event", err);
  }
}

// GET /crm/t/o/:campaignId/:memberKey — open pixel
crmTracking.get("/o/:campaignId/:memberKey", async (c) => {
  const { campaignId, memberKey } = c.req.param();
  recordEvent({ campaignId, memberKey, type: "open" });

  c.header("Content-Type", "image/gif");
  c.header("Cache-Control", "no-store");
  return c.body(PIXEL_GIF);
});

// GET /crm/t/c/:campaignId/:memberKey?u=<original> — click redirect
crmTracking.get("/c/:campaignId/:memberKey", async (c) => {
  const { campaignId, memberKey } = c.req.param();
  const target = c.req.query("u");
  if (!target) return c.json({ error: "missing u" }, 400);

  recordEvent({ campaignId, memberKey, type: "click", url: target });

  return c.redirect(target, 302);
});
