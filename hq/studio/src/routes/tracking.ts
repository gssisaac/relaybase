import { Hono } from "hono";
import {
  accountService,
  analyticsService,
  assetService,
  DEV_ACCOUNT_LINK_ID,
  messageService,
  newsletterService,
  subscriberGroupService,
  studioDocumentService,
  templateService,
  trackingService,
  triggerService,
} from "@services/index";
export const studioTracking = new Hono();

// GET /studio/t/o/:broadcastId/:recipientId — open pixel
studioTracking.get("/o/:broadcastId/:recipientId", async (c) => {
  const { broadcastId, recipientId } = c.req.param();
  trackingService.recordNewsletterOpen(broadcastId, recipientId);

  c.header("Content-Type", "image/gif");
  c.header("Cache-Control", "no-store");
  return c.body(trackingService.trackingPixelGif);
});

// GET /studio/t/c/:broadcastId/:recipientId?u=<original> — click redirect
studioTracking.get("/c/:broadcastId/:recipientId", async (c) => {
  const { broadcastId, recipientId } = c.req.param();
  const target = c.req.query("u");
  if (!target) return c.json({ error: "missing u" }, 400);

  const safe = trackingService.safeRedirectTarget(target);
  if (!safe) return c.json({ error: "invalid redirect target" }, 400);

  trackingService.recordNewsletterClick(broadcastId, recipientId, safe);

  return c.redirect(safe, 302);
});
