import { Hono } from "hono";
import { DEV_ACCOUNT_LINK_ID, store } from "../db/store";
import {
  COMPLIANCE_FOOTER_TAG,
  templateHasEmbeddedComplianceFooter,
} from "../lib/broadcast-standard-footer";
import { newId } from "../lib/ids";
import type { Template } from "../db/types";

export const crmTemplates = new Hono();

function serialize(row: Template) {
  return {
    id: row.id,
    name: row.name,
    htmlSource: row.htmlSource,
    isBuiltin: row.isBuiltin,
    createdAt: row.createdAt,
  };
}

// GET /crm/templates — built-in (shared) + this account's custom imports
crmTemplates.get("/", async (c) => {
  const data = store.read();
  const rows = data.templates.filter(
    (t) => t.isBuiltin || t.accountLinkId === DEV_ACCOUNT_LINK_ID || t.accountLinkId === null,
  );
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

  let resolvedHtml = htmlSource;
  if (!templateHasEmbeddedComplianceFooter(htmlSource)) {
    resolvedHtml = `${htmlSource.trimEnd()}\n${COMPLIANCE_FOOTER_TAG}`;
  }

  const warnings: string[] = [];
  if (!resolvedHtml.includes("{{unsubscribe_url}}") && !resolvedHtml.includes(COMPLIANCE_FOOTER_TAG)) {
    warnings.push("Missing unsubscribe link increases spam-report risk.");
  }

  const id = newId("template");
  const now = new Date().toISOString();
  let created: Template | null = null;
  store.update((draft) => {
    created = {
      id,
      accountLinkId: DEV_ACCOUNT_LINK_ID,
      name,
      htmlSource: resolvedHtml,
      isBuiltin: false,
      createdAt: now,
    };
    draft.templates.push(created);
  });

  return c.json({ template: serialize(created!), warnings }, 201);
});
