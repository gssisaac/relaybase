import { Hono } from "hono";
import { cors } from "hono/cors";
import { studioAccountLink } from "./routes/account-link";
import { studioComplianceIdentities } from "./routes/compliance-identities";
import { studioSubscriberGroups } from "./routes/subscriber-groups";
import { studioNewsletters } from "./routes/newsletters";
import { studioTemplates } from "./routes/templates";
import { studioMessageTemplates } from "./routes/message-templates";
import { studioMessages } from "./routes/messages";
import { studioTracking } from "./routes/tracking";
import { studioAssets } from "./routes/assets";
import { studioUnsubscribe } from "./routes/unsubscribe";
import { studioWebhooks } from "./routes/webhooks";
import { studioTriggers } from "./routes/triggers";
import { studioTriggerHooks } from "./routes/trigger-hooks";
import { studioTriggerTracking } from "./routes/trigger-tracking";
import { studioDashboard } from "./routes/dashboard";
import { studioOverview } from "./routes/overview";
import { studioApiAuthMiddleware } from "./lib/auth/studio-api-auth";
import { hqAuth } from "./routes/auth";
import { studioWorkerCatalog } from "./routes/worker-catalog";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: (origin) => origin ?? "*",
    credentials: true,
  }),
);
app.use("*", studioApiAuthMiddleware());

app.get("/health", (c) => c.json({ ok: true, service: "relaybase-studio" }));

app.route("/auth", hqAuth);

app.route("/studio/account-link", studioAccountLink);
app.route("/studio/worker-catalog", studioWorkerCatalog);
app.route("/studio/compliance-identities", studioComplianceIdentities);
app.route("/studio/overview", studioOverview);
app.route("/studio/dashboard", studioDashboard);
app.route("/studio/newsletters", studioNewsletters);
app.route("/studio/triggers", studioTriggers);
app.route("/studio/hooks", studioTriggerHooks);
app.route("/studio/t/a", studioTriggerTracking);
app.route("/studio/subscriber-groups", studioSubscriberGroups);
app.route("/studio/layouts", studioTemplates);
app.route("/studio/templates", studioMessageTemplates);
app.route("/studio/messages", studioMessages);
app.route("/studio/t", studioTracking);
app.route("/studio/unsubscribe", studioUnsubscribe);
app.route("/studio/webhooks", studioWebhooks);
app.route("/studio", studioAssets);

export default app;
