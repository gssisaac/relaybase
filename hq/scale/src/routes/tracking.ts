import { Hono } from "hono";
import { resolveSafeRedirectTarget } from "../lib/tracking/redirect";
import { recordTrackingClick, recordTrackingOpen, TRACKING_PIXEL_GIF } from "../lib/tracking/record";

export const scaleTracking = new Hono();

// GET /scale/t/o/:broadcastId/:recipientId — open pixel
scaleTracking.get("/o/:broadcastId/:recipientId", async (c) => {
  const { broadcastId, recipientId } = c.req.param();
  recordTrackingOpen(broadcastId, recipientId);

  c.header("Content-Type", "image/gif");
  c.header("Cache-Control", "no-store");
  return c.body(TRACKING_PIXEL_GIF);
});

// GET /scale/t/c/:broadcastId/:recipientId?u=<original> — click redirect
scaleTracking.get("/c/:broadcastId/:recipientId", async (c) => {
  const { broadcastId, recipientId } = c.req.param();
  const target = c.req.query("u");
  if (!target) return c.json({ error: "missing u" }, 400);

  const safe = resolveSafeRedirectTarget(target);
  if (!safe) return c.json({ error: "invalid redirect target" }, 400);

  recordTrackingClick(broadcastId, recipientId, safe);

  return c.redirect(safe, 302);
});
