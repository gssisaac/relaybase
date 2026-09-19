import {
  DEV_ACCOUNT_LINK_ID,
  messageService,
  studioDocumentService,
  templateService,
} from "@services/index";

import { Hono } from "hono";

export const studioMessageTemplates = new Hono();

/** Read-only template catalog (blueprints). */
studioMessageTemplates.get("/", (c) => {
  const rows = templateService.listAll();
  return c.json({ templates: rows.map((row) => messageService.serializeTemplateRow(row)) });
});

studioMessageTemplates.get("/:id", (c) => {
  const row = templateService.findById(c.req.param("id"));
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json({ template: messageService.serializeTemplateRow(row) });
});

/** Fork catalog template into a new editable Message. */
studioMessageTemplates.post("/:id/use", async (c) => {
  const templateId = c.req.param("id");
  if (!templateService.findById(templateId)) {
    return c.json({ error: "template not found" }, 404);
  }

  let body: { name?: string };
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }

  const now = new Date().toISOString();
  let forkedId: string | null = null;
  studioDocumentService.mutate((draft) => {
    const row = messageService.forkFromTemplate(
      draft,
      templateId,
      { accountLinkId: DEV_ACCOUNT_LINK_ID, name: body.name?.trim() },
      now,
    );
    forkedId = row?.id ?? null;
  });

  const latest = forkedId ? messageService.findById(forkedId) : undefined;
  if (!latest) {
    return c.json({ error: "could not fork template" }, 500);
  }

  return c.json({ message: messageService.serializeMessage(latest) }, 201);
});
