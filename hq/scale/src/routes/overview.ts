import { Hono } from "hono";

import { buildScaleOverview } from "../lib/overview/build-scale-overview";

export const scaleOverview = new Hono();

scaleOverview.get("/", (c) => {
  return c.json(buildScaleOverview());
});
