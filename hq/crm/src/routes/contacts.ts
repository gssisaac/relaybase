import { Hono } from "hono";

/**
 * Stub — real handlers land with the `contacts` D1 table (crm-mode-v0.2.md P0-1).
 */
export const crmContacts = new Hono();

crmContacts.get("/", (c) => {
  return c.json({ contacts: [] });
});
