import { Hono } from "hono";
import { cors } from "hono/cors";
import { crmAccountLink } from "./routes/account-link";
import { crmAudience } from "./routes/audience-groups";
import { crmBroadcasts } from "./routes/broadcasts";
import { crmTemplates } from "./routes/templates";
import { crmTracking } from "./routes/tracking";
import { crmAssets } from "./routes/assets";
import { crmUnsubscribe } from "./routes/unsubscribe";
import { crmWebhooks } from "./routes/webhooks";
import { crmApiAuthMiddleware } from "./lib/crm-api-auth";

const app = new Hono();

app.use("*", cors({ origin: "*" }));
app.use("*", crmApiAuthMiddleware());

app.get("/health", (c) => c.json({ ok: true, service: "relaybase-crm" }));

app.route("/crm/account-link", crmAccountLink);
app.route("/crm/broadcasts", crmBroadcasts);
app.route("/crm/audience-groups", crmAudience);
app.route("/crm/templates", crmTemplates);
app.route("/crm/t", crmTracking);
app.route("/crm/unsubscribe", crmUnsubscribe);
app.route("/crm/webhooks", crmWebhooks);
app.route("/crm", crmAssets);

export default app;
