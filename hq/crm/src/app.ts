import { Hono } from "hono";
import { cors } from "hono/cors";
import { crmSubscribers } from "./routes/subscribers";
import { crmAudience } from "./routes/audience-groups";
import { crmCampaigns } from "./routes/campaigns";
import { crmBroadcasts } from "./routes/broadcasts";
import { crmTemplates } from "./routes/templates";
import { crmTracking } from "./routes/tracking";
import { crmAssets } from "./routes/assets";
import { crmUnsubscribe } from "./routes/unsubscribe";
import { crmWebhooks } from "./routes/webhooks";

const app = new Hono();

// Dev-only permissive CORS — production auth model is the shared console
// session cookie on `.relaybase.xyz` (§1.3), not relevant to local testing
// across ports.
app.use("*", cors({ origin: "*" }));

app.get("/health", (c) => c.json({ ok: true, service: "relaybase-crm" }));

app.route("/crm/campaigns/:campaignId/subscribers", crmSubscribers);
app.route("/crm/campaigns/:campaignId/broadcasts", crmBroadcasts);
app.route("/crm/campaigns", crmCampaigns);
app.route("/crm/audience-groups", crmAudience);
app.route("/crm/templates", crmTemplates);
app.route("/crm/t", crmTracking);
app.route("/crm/unsubscribe", crmUnsubscribe);
app.route("/crm/webhooks", crmWebhooks);
app.route("/crm", crmAssets);

export default app;
