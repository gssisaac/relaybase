import { Hono } from "hono";
import { cors } from "hono/cors";
import { crmAudience } from "./routes/audience";
import { crmPipeline } from "./routes/pipeline";
import { crmCampaigns } from "./routes/campaigns";
import { crmTemplates } from "./routes/templates";
import { crmTracking } from "./routes/tracking";
import { crmAssets } from "./routes/assets";

const app = new Hono();

// Dev-only permissive CORS — production auth model is the shared console
// session cookie on `.relaybase.xyz` (§1.3), not relevant to local testing
// across ports.
app.use("*", cors({ origin: "*" }));

app.get("/health", (c) => c.json({ ok: true, service: "relaybase-crm" }));

app.route("/crm/audience-groups", crmAudience);
app.route("/crm/pipeline", crmPipeline);
app.route("/crm/campaigns", crmCampaigns);
app.route("/crm/templates", crmTemplates);
app.route("/crm/t", crmTracking);
app.route("/crm", crmAssets);

export default app;
