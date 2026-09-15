import { Hono } from "hono";
import { cors } from "hono/cors";
import { scaleAccountLink } from "./routes/account-link";
import { scaleComplianceIdentities } from "./routes/compliance-identities";
import { scaleAudience } from "./routes/audience-groups";
import { scaleCampaigns } from "./routes/campaigns";
import { scaleTemplates } from "./routes/templates";
import { scaleMessageTemplates } from "./routes/message-templates";
import { scaleTracking } from "./routes/tracking";
import { scaleAssets } from "./routes/assets";
import { scaleUnsubscribe } from "./routes/unsubscribe";
import { scaleWebhooks } from "./routes/webhooks";
import { scaleTriggers } from "./routes/triggers";
import { scaleTriggerHooks } from "./routes/trigger-hooks";
import { scaleTriggerTracking } from "./routes/trigger-tracking";
import { scaleOverview } from "./routes/overview";
import { scaleApiAuthMiddleware } from "./lib/auth/scale-api-auth";

const app = new Hono();

app.use("*", cors({ origin: "*" }));
app.use("*", scaleApiAuthMiddleware());

/** Legacy public links and bookmarks still use /crm/* */
app.all("/crm", (c) => c.redirect("/scale/overview", 308));
app.all("/crm/*", (c) => {
  const url = new URL(c.req.url);
  url.pathname = url.pathname.replace(/^\/crm/, "/scale");
  return c.redirect(url.toString(), 308);
});

app.get("/health", (c) => c.json({ ok: true, service: "relaybase-scale" }));

app.route("/scale/account-link", scaleAccountLink);
app.route("/scale/compliance-identities", scaleComplianceIdentities);
app.route("/scale/overview", scaleOverview);
app.route("/scale/campaigns", scaleCampaigns);
app.route("/scale/triggers", scaleTriggers);
app.route("/scale/hooks", scaleTriggerHooks);
app.route("/scale/t/a", scaleTriggerTracking);
app.route("/scale/audience-groups", scaleAudience);
app.route("/scale/layouts", scaleTemplates);
app.route("/scale/templates", scaleMessageTemplates);
app.route("/scale/t", scaleTracking);
app.route("/scale/unsubscribe", scaleUnsubscribe);
app.route("/scale/webhooks", scaleWebhooks);
app.route("/scale", scaleAssets);

export default app;
