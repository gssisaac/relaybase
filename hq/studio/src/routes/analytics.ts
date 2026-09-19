import { Hono } from "hono";
import {
  analyticsService,
} from "@services/index";

export const studioAnalytics = new Hono();

studioAnalytics.get("/", (c) => {
  return c.json(analyticsService.buildAnalytics());
});
