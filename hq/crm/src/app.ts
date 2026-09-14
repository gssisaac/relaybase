import { Hono } from "hono";
import { cors } from "hono/cors";
import { crmContacts } from "./routes/contacts";
import { crmPipeline } from "./routes/pipeline";
import { crmCampaigns } from "./routes/campaigns";
import { crmTemplates } from "./routes/templates";
import { crmTracking } from "./routes/tracking";

const app = new Hono();

// Dev-only permissive CORS — production auth model is the shared console
// session cookie on `.relaybase.xyz` (§1.3), not relevant to local testing
// across ports.
app.use("*", cors({ origin: "*" }));

app.get("/health", (c) => c.json({ ok: true, service: "relaybase-crm" }));

app.route("/crm/contacts", crmContacts);
app.route("/crm/pipeline", crmPipeline);
app.route("/crm/campaigns", crmCampaigns);
app.route("/crm/templates", crmTemplates);
app.route("/crm/t", crmTracking);

export default app;
