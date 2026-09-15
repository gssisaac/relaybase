import { Hono } from "hono";

import { resolveSafeRedirectTarget } from "../lib/tracking/redirect";
import {
  recordAutomationTrackingClick,
  recordAutomationTrackingOpen,
} from "../lib/tracking/automation-record";
import { TRACKING_PIXEL_GIF } from "../lib/tracking/record";

export const crmAutomationTracking = new Hono();

crmAutomationTracking.get("/o/:automationId/:automationSendId", async (c) => {
  const { automationId, automationSendId } = c.req.param();
  recordAutomationTrackingOpen(automationId, automationSendId);

  c.header("Content-Type", "image/gif");
  c.header("Cache-Control", "no-store");
  return c.body(TRACKING_PIXEL_GIF);
});

crmAutomationTracking.get("/c/:automationId/:automationSendId", async (c) => {
  const { automationId, automationSendId } = c.req.param();
  const target = c.req.query("u");
  if (!target) return c.json({ error: "missing u" }, 400);

  const safe = resolveSafeRedirectTarget(target);
  if (!safe) return c.json({ error: "invalid redirect target" }, 400);

  recordAutomationTrackingClick(automationId, automationSendId, safe);

  return c.redirect(safe, 302);
});
