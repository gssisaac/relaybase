import { Hono } from "hono";

import { forkMessageFromTemplate } from "@lib/messages/message";
import { messageFileStore } from "@lib/messages/message-file-store";
import { serializeMessage } from "@lib/messages/serialize-message";
import { serializeTemplate } from "@lib/messages/serialize-template";
import { templateCatalogStore } from "@lib/templates/template-catalog-store";
import { DEV_ACCOUNT_LINK_ID } from "@services/studio/constants";
import { readStudioDocument, mutateStudioDocument } from "@services/studio/studio-document.service";

export const studioMessageTemplates = new Hono();

/** Read-only template catalog (blueprints). */
studioMessageTemplates.get("/", (c) => {
  const rows = templateCatalogStore.listAll();
  return c.json({ templates: rows.map(serializeTemplate) });
});

studioMessageTemplates.get("/:id", (c) => {
  const row = templateCatalogStore.findById(c.req.param("id"));
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json({ template: serializeTemplate(row) });
});

/** Fork catalog template into a new editable Message. */
studioMessageTemplates.post("/:id/use", async (c) => {
  const templateId = c.req.param("id");
  if (!templateCatalogStore.findById(templateId)) {
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
  mutateStudioDocument((draft) => {
    const row = forkMessageFromTemplate(
      draft,
      templateId,
      { accountLinkId: DEV_ACCOUNT_LINK_ID, name: body.name?.trim() },
      now,
    );
    forkedId = row?.id ?? null;
  });

  const latest = forkedId ? messageFileStore.findById(forkedId) : undefined;
  if (!latest) {
    return c.json({ error: "could not fork template" }, 500);
  }

  return c.json({ message: serializeMessage(latest) }, 201);
});
