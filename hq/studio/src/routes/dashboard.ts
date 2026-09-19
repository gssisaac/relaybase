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

export const studioDashboard = new Hono();

studioDashboard.get("/", (c) => {
  return c.json(analyticsService.buildDashboard());
});
