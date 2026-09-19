import { Hono } from "hono";
import { DEV_ACCOUNT_LINK_ID, studioService } from "@services/studio-service";
import type { Layout } from "@db/types";
import { newId } from "@lib/shared/ids";
import { serializeLayout } from "@lib/templates/layout-serialize";
import { prepareTemplateImport } from "@lib/templates/prepare-import";
import {
  canAccessCustomLayout,
  layoutReferencedByMessages,
  nextCustomForkName,
} from "@lib/templates/layout-access";

export const studioTemplates = new Hono();

// GET /studio/templates — built-in (shared) + this account's custom HTML layouts
studioTemplates.get("/", async (c) => {
  const data = studioService.read();
  const rows = data.layouts.filter(
    (t) => t.isBuiltin || t.accountLinkId === DEV_ACCOUNT_LINK_ID || t.accountLinkId === null,
  );
  return c.json({ layouts: rows.map(serializeLayout) });
});

// GET /studio/layouts/:id
studioTemplates.get("/:id", (c) => {
  const id = c.req.param("id");
  const data = studioService.read();
  const row = data.layouts.find((t) => t.id === id);
  if (!row) return c.json({ error: "template not found" }, 404);
  if (!row.isBuiltin && !canAccessCustomLayout(row)) {
    return c.json({ error: "forbidden" }, 403);
  }
  return c.json({ layout: serializeLayout(row) });
});

// POST /studio/templates { name, htmlSource } — custom layout import
studioTemplates.post("/", async (c) => {
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
  let created: Layout | null = null;
  studioService.update((draft) => {
    created = {
      id,
      accountLinkId: DEV_ACCOUNT_LINK_ID,
      name,
      htmlSource: prepared.htmlSource,
      variablesSchema: prepared.variablesSchema,
      isBuiltin: false,
      derivedFromLayoutId: null,
      createdAt: now,
    };
    draft.layouts.push(created);
  });

  return c.json({ layout: serializeLayout(created!), warnings: prepared.warnings }, 201);
});

/**
 * PATCH /studio/templates/:id/source { htmlSource }
 * — update a custom layout, or fork a built-in into a new custom row when edited.
 */
studioTemplates.patch("/:id/source", async (c) => {
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

  const data = studioService.read();
  const existing = data.layouts.find((t) => t.id === id);
  if (!existing) {
    return c.json({ error: "template not found" }, 404);
  }

  const prepared = prepareTemplateImport({ htmlSource });
  if ("error" in prepared) {
    return c.json({ error: prepared.error }, 400);
  }

  if (existing.isBuiltin) {
    const now = new Date().toISOString();
    let created: Layout | null = null;
    studioService.update((draft) => {
      const source = draft.layouts.find((t) => t.id === id);
      if (!source?.isBuiltin) return;
      const forkName = nextCustomForkName(draft.layouts, source.name);
      created = {
        id: newId("template"),
        accountLinkId: DEV_ACCOUNT_LINK_ID,
        name: forkName,
        htmlSource: prepared.htmlSource,
        variablesSchema: source.variablesSchema ?? null,
        isBuiltin: false,
        derivedFromLayoutId: source.id,
        createdAt: now,
      };
      draft.layouts.push(created);
    });

    if (!created) {
      return c.json({ error: "template not found" }, 404);
    }

    return c.json(
      {
        layout: serializeLayout(created),
        forked: true,
        warnings: prepared.warnings,
      },
      201,
    );
  }

  if (!canAccessCustomLayout(existing)) {
    return c.json({ error: "forbidden" }, 403);
  }

  if (nameFromBody !== undefined && !nameFromBody) {
    return c.json({ error: "name cannot be empty" }, 400);
  }

  let updated: Layout | null = null;
  studioService.update((draft) => {
    const row = draft.layouts.find((t) => t.id === id);
    if (!row || row.isBuiltin || !canAccessCustomLayout(row)) return;
    row.htmlSource = prepared.htmlSource;
    if (nameFromBody) row.name = nameFromBody;
    updated = row;
  });

  if (!updated) {
    return c.json({ error: "template not found" }, 404);
  }

  return c.json({
    layout: serializeLayout(updated),
    forked: false,
    warnings: prepared.warnings,
  });
});

// DELETE /studio/layouts/:id — custom layouts only
studioTemplates.delete("/:id", (c) => {
  const id = c.req.param("id");
  const data = studioService.read();
  const existing = data.layouts.find((t) => t.id === id);
  if (!existing) return c.json({ error: "template not found" }, 404);
  if (existing.isBuiltin) {
    return c.json({ error: "built-in layouts cannot be deleted" }, 409);
  }
  if (!canAccessCustomLayout(existing)) {
    return c.json({ error: "forbidden" }, 403);
  }
  if (layoutReferencedByMessages(id)) {
    return c.json({ error: "layout is used by one or more message templates" }, 409);
  }

  let removed = false;
  studioService.update((draft) => {
    const idx = draft.layouts.findIndex((t) => t.id === id);
    if (idx < 0) return;
    const row = draft.layouts[idx]!;
    if (row.isBuiltin || !canAccessCustomLayout(row)) return;
    draft.layouts.splice(idx, 1);
    removed = true;
  });

  if (!removed) return c.json({ error: "template not found" }, 404);
  return c.json({ ok: true });
});
