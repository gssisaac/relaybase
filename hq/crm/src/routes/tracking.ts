import { Hono } from "hono";
import { db } from "../db/client";
import { trackingEvents } from "../db/schema";
import { newId } from "../lib/ids";

export const crmTracking = new Hono();

/** 1x1 transparent GIF (P0-2). */
const PIXEL_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7",
  "base64",
);

// GET /crm/t/o/:campaignId/:contactId — open pixel, always 200 (P0-2 UC-1)
crmTracking.get("/o/:campaignId/:contactId", async (c) => {
  const { campaignId, contactId } = c.req.param();
  // Fire-and-forget: never delay the pixel response on the write.
  void db
    .insert(trackingEvents)
    .values({
      id: newId("track"),
      campaignId,
      contactId,
      type: "open",
      occurredAt: new Date().toISOString(),
    })
    .catch((err) => console.error("[crm-tracking] failed to record open", err));

  c.header("Content-Type", "image/gif");
  c.header("Cache-Control", "no-store");
  return c.body(PIXEL_GIF);
});

// GET /crm/t/c/:campaignId/:contactId?u=<original> — click redirect (P0-2 UC-2)
crmTracking.get("/c/:campaignId/:contactId", async (c) => {
  const { campaignId, contactId } = c.req.param();
  const target = c.req.query("u");
  if (!target) return c.json({ error: "missing u" }, 400);

  void db
    .insert(trackingEvents)
    .values({
      id: newId("track"),
      campaignId,
      contactId,
      type: "click",
      url: target,
      occurredAt: new Date().toISOString(),
    })
    .catch((err) => console.error("[crm-tracking] failed to record click", err));

  return c.redirect(target, 302);
});
