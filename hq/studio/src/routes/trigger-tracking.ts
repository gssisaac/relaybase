import { Hono } from "hono";

import { resolveSafeRedirectTarget } from "../lib/tracking/redirect";
import {
  recordAutomationTrackingClick,
  recordAutomationTrackingOpen,
} from "../lib/tracking/trigger-record";
import { TRACKING_PIXEL_GIF } from "../lib/tracking/record";

export const studioTriggerTracking = new Hono();

studioTriggerTracking.get("/o/:triggerId/:triggerSendId", async (c) => {
  const { triggerId, triggerSendId } = c.req.param();
  recordAutomationTrackingOpen(triggerId, triggerSendId);

  c.header("Content-Type", "image/gif");
  c.header("Cache-Control", "no-store");
  return c.body(TRACKING_PIXEL_GIF);
});

studioTriggerTracking.get("/c/:triggerId/:triggerSendId", async (c) => {
  const { triggerId, triggerSendId } = c.req.param();
  const target = c.req.query("u");
  if (!target) return c.json({ error: "missing u" }, 400);

  const safe = resolveSafeRedirectTarget(target);
  if (!safe) return c.json({ error: "invalid redirect target" }, 400);

  recordAutomationTrackingClick(triggerId, triggerSendId, safe);

  return c.redirect(safe, 302);
});
