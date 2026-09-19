import { Hono } from "hono";

import { buildStudioAnalytics } from "../lib/analytics/build-studio-analytics";

export const studioAnalytics = new Hono();

studioAnalytics.get("/", (c) => {
  return c.json(buildStudioAnalytics());
});
