import { Hono } from "hono";

import { buildStudioDashboard } from "../lib/dashboard/build-studio-dashboard";

export const studioDashboard = new Hono();

studioDashboard.get("/", (c) => {
  return c.json(buildStudioDashboard());
});
