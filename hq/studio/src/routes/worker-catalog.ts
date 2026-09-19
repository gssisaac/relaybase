import { Hono } from "hono";

import { fetchWorkerCatalogDomainNames } from "../lib/worker/fetch-console-domains";

export const studioWorkerCatalog = new Hono();

/** GET /studio/worker-catalog/domains — Worker sending domain names (server-side when passtoken set). */
studioWorkerCatalog.get("/domains", async (c) => {
  const domains = await fetchWorkerCatalogDomainNames();
  return c.json({ domains });
});
