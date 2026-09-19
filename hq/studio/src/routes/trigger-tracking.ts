import { Hono } from "hono";
import {
  trackingService,
} from "@services/index";

export const studioTriggerTracking = new Hono();

studioTriggerTracking.get("/o/:triggerId/:triggerSendId", async (c) => {
  const { triggerId, triggerSendId } = c.req.param();
  trackingService.recordTriggerOpen(triggerId, triggerSendId);

  c.header("Content-Type", "image/gif");
  c.header("Cache-Control", "no-store");
  return c.body(trackingService.trackingPixelGif);
});

studioTriggerTracking.get("/c/:triggerId/:triggerSendId", async (c) => {
  const { triggerId, triggerSendId } = c.req.param();
  const target = c.req.query("u");
  if (!target) return c.json({ error: "missing u" }, 400);

  const safe = trackingService.safeRedirectTarget(target);
  if (!safe) return c.json({ error: "invalid redirect target" }, 400);

  trackingService.recordTriggerClick(triggerId, triggerSendId, safe);

  return c.redirect(safe, 302);
});
