import { Hono } from "hono";

import { buildScaleOverview } from "../lib/overview/build-studio-overview";

export const studioOverview = new Hono();

studioOverview.get("/", (c) => {
  return c.json(buildScaleOverview());
});
