import { Hono } from "hono";
import { DEV_ACCOUNT_LINK_ID, store } from "../db/store";
import type { Template } from "../db/types";
import { newId } from "../lib/shared/ids";
import { serializeTemplate } from "../lib/templates/api-serialize";
import { prepareTemplateImport } from "../lib/templates/prepare-import";

export const crmTemplates = new Hono();

function canAccessCustomTemplate(row: Template): boolean {
  return row.accountLinkId === DEV_ACCOUNT_LINK_ID || row.accountLinkId === null;
}

function nextCustomForkName(templates: Template[], baseName: string): string {
  const first = `${baseName} (custom)`;
  if (!templates.some((t) => t.name === first)) return first;
  let n = 2;
  while (templates.some((t) => t.name === `${baseName} (custom ${n})`)) n += 1;
  return `${baseName} (custom ${n})`;
}

// GET /crm/templates — built-in (shared) + this account's custom imports
crmTemplates.get("/", async (c) => {
  const data = store.read();
  const rows = data.templates.filter(
    (t) => t.isBuiltin || t.accountLinkId === DEV_ACCOUNT_LINK_ID || t.accountLinkId === null,
  );
  return c.json({ templates: rows.map(serializeTemplate) });
});

// POST /crm/templates { name, htmlSource } — custom import (P0-6 UC-5/6/7)
crmTemplates.post("/", async (c) => {
  let body: { name?: string; htmlSource?: string; variablesYaml?: string };
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

  const prepared = prepareTemplateImport({
    htmlSource,
    variablesYaml: body.variablesYaml,
  });
  if ("error" in prepared) {
    return c.json({ error: prepared.error }, 400);
  }

  const id = newId("template");
  const now = new Date().toISOString();
  let created: Template | null = null;
  store.update((draft) => {
    created = {
      id,
      accountLinkId: DEV_ACCOUNT_LINK_ID,
      name,
      htmlSource: prepared.htmlSource,
      variablesSchema: prepared.variablesSchema,
      isBuiltin: false,
      derivedFromTemplateId: null,
      createdAt: now,
    };
    draft.templates.push(created);
  });

  return c.json({ template: serializeTemplate(created!), warnings: prepared.warnings }, 201);
});

/**
 * PATCH /crm/templates/:id/source { htmlSource }
 * — update a custom template, or fork a built-in into a new custom row when edited.
 */
crmTemplates.patch("/:id/source", async (c) => {
  const id = c.req.param("id");
  let body: { htmlSource?: string; name?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }

  const htmlSource = body.htmlSource;
  if (!htmlSource) {
    return c.json({ error: "htmlSource is required" }, 400);
  }
  const nameFromBody = body.name?.trim();

  const data = store.read();
  const existing = data.templates.find((t) => t.id === id);
  if (!existing) {
    return c.json({ error: "template not found" }, 404);
  }

  const prepared = prepareTemplateImport({ htmlSource });
  if ("error" in prepared) {
    return c.json({ error: prepared.error }, 400);
  }

  if (existing.isBuiltin) {
    const now = new Date().toISOString();
    let created: Template | null = null;
    store.update((draft) => {
      const source = draft.templates.find((t) => t.id === id);
      if (!source?.isBuiltin) return;
      const forkName = nextCustomForkName(draft.templates, source.name);
      created = {
        id: newId("template"),
        accountLinkId: DEV_ACCOUNT_LINK_ID,
        name: forkName,
        htmlSource: prepared.htmlSource,
        variablesSchema: source.variablesSchema ?? null,
        isBuiltin: false,
        derivedFromTemplateId: source.id,
        createdAt: now,
      };
      draft.templates.push(created);
    });

    if (!created) {
      return c.json({ error: "template not found" }, 404);
    }

    return c.json(
      {
        template: serializeTemplate(created),
        forked: true,
        warnings: prepared.warnings,
      },
      201,
    );
  }

  if (!canAccessCustomTemplate(existing)) {
    return c.json({ error: "forbidden" }, 403);
  }

  if (nameFromBody !== undefined && !nameFromBody) {
    return c.json({ error: "name cannot be empty" }, 400);
  }

  let updated: Template | null = null;
  store.update((draft) => {
    const row = draft.templates.find((t) => t.id === id);
    if (!row || row.isBuiltin || !canAccessCustomTemplate(row)) return;
    row.htmlSource = prepared.htmlSource;
    if (nameFromBody) row.name = nameFromBody;
    updated = row;
  });

  if (!updated) {
    return c.json({ error: "template not found" }, 404);
  }

  return c.json({
    template: serializeTemplate(updated),
    forked: false,
    warnings: prepared.warnings,
  });
});
