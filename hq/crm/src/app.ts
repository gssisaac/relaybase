import { Hono } from "hono";
import { crmContacts } from "./routes/contacts";

const app = new Hono();

app.get("/health", (c) => c.json({ ok: true, service: "relaybase-crm" }));

app.route("/crm/contacts", crmContacts);

export default app;
