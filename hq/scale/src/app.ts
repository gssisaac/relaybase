import { Hono } from "hono";
import { cors } from "hono/cors";
import { scaleAccountLink } from "./routes/account-link";
import { scaleComplianceIdentities } from "./routes/compliance-identities";
import { scaleAudience } from "./routes/audience-groups";
import { scaleBroadcasts } from "./routes/broadcasts";
import { scaleTemplates } from "./routes/templates";
import { scaleTracking } from "./routes/tracking";
import { scaleAssets } from "./routes/assets";
import { scaleUnsubscribe } from "./routes/unsubscribe";
import { scaleWebhooks } from "./routes/webhooks";
import { scaleAutomations } from "./routes/automations";
import { scaleAutomationHooks } from "./routes/automation-hooks";
import { scaleAutomationTracking } from "./routes/automation-tracking";
import { scaleApiAuthMiddleware } from "./lib/auth/scale-api-auth";

const app = new Hono();

app.use("*", cors({ origin: "*" }));
app.use("*", scaleApiAuthMiddleware());

/** Legacy public links and bookmarks still use /crm/* */
app.all("/crm", (c) => c.redirect("/scale/audience", 308));
app.all("/crm/*", (c) => {
  const url = new URL(c.req.url);
  url.pathname = url.pathname.replace(/^\/crm/, "/scale");
  return c.redirect(url.toString(), 308);
});

app.get("/health", (c) => c.json({ ok: true, service: "relaybase-scale" }));

app.route("/scale/account-link", scaleAccountLink);
app.route("/scale/compliance-identities", scaleComplianceIdentities);
app.route("/scale/broadcasts", scaleBroadcasts);
app.route("/scale/automations", scaleAutomations);
app.route("/scale/hooks", scaleAutomationHooks);
app.route("/scale/t/a", scaleAutomationTracking);
app.route("/scale/audience-groups", scaleAudience);
app.route("/scale/templates", scaleTemplates);
app.route("/scale/t", scaleTracking);
app.route("/scale/unsubscribe", scaleUnsubscribe);
app.route("/scale/webhooks", scaleWebhooks);
app.route("/scale", scaleAssets);

export default app;
