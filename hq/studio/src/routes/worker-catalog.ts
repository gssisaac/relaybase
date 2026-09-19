import { Hono } from "hono";
import {
  accountService,
} from "@services/index";

export const studioWorkerCatalog = new Hono();

/** GET /studio/worker-catalog/domains — Worker sending domain names (server-side when passtoken set). */
studioWorkerCatalog.get("/domains", async (c) => {
  const domains = await accountService.fetchConsoleDomainNames();
  return c.json({ domains });
});
