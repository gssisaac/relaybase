import { Hono } from "hono";
import { eq, isNull, or } from "drizzle-orm";
import { db, DEV_ACCOUNT_LINK_ID } from "../db/client";
import { templates } from "../db/schema";
import { newId } from "../lib/ids";

export const crmTemplates = new Hono();

function serialize(row: typeof templates.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    htmlSource: row.htmlSource,
    isBuiltin: Boolean(row.isBuiltin),
    createdAt: row.createdAt,
  };
}

// GET /crm/templates — built-in (shared) + this account's custom imports
crmTemplates.get("/", async (c) => {
  const rows = await db
    .select()
    .from(templates)
    .where(or(isNull(templates.accountLinkId), eq(templates.accountLinkId, DEV_ACCOUNT_LINK_ID)));
  return c.json({ templates: rows.map(serialize) });
});

// POST /crm/templates { name, htmlSource } — custom import (P0-6 UC-5/6/7)
crmTemplates.post("/", async (c) => {
  let body: { name?: string; htmlSource?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }

  const name = body.name?.trim();
  const htmlSource = body.htmlSource;
  if (!name || !htmlSource) {
    return c.json({ error: "name and htmlSource are required" }, 400);
  }
  if (!htmlSource.includes("{{content}}")) {
    return c.json(
      { error: "Template must include a {{content}} placeholder marking where content goes." },
      400,
    );
  }

  const warnings: string[] = [];
  if (!htmlSource.includes("{{unsubscribe_url}}")) {
    warnings.push("Missing unsubscribe link increases spam-report risk.");
  }

  const id = newId("template");
  await db.insert(templates).values({
    id,
    accountLinkId: DEV_ACCOUNT_LINK_ID,
    name,
    htmlSource,
    isBuiltin: 0,
    createdAt: new Date().toISOString(),
  });

  const row = await db.select().from(templates).where(eq(templates.id, id)).get();
  return c.json({ template: serialize(row!), warnings }, 201);
});
