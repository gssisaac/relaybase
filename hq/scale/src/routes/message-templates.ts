import { Hono } from "hono";

import { DEV_ACCOUNT_LINK_ID, store } from "../db/store";
import { newsletterAssetKey } from "../lib/assets/key";
import { patchMessageTemplate } from "../lib/messages/message-template";
import { serializeMessageTemplate } from "../lib/messages/serialize-template";
import { newId } from "../lib/shared/ids";
import { SCALE_PUBLIC_BASE_URL } from "../lib/shared/scale-url";

export const scaleMessageTemplates = new Hono();

function sanitizeTemplateVariables(raw: Record<string, string> | undefined): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== "string") continue;
    if (!/^[a-z][a-z0-9]*(\.[a-z][a-z0-9_]*)*$/.test(key)) continue;
    out[key] = value.trim();
  }
  return out;
}

scaleMessageTemplates.get("/", (c) => {
  const rows = store
    .read()
    .templates.filter((t) => t.accountLinkId === DEV_ACCOUNT_LINK_ID || t.isPreset);
  return c.json({ templates: rows.map(serializeMessageTemplate) });
});

scaleMessageTemplates.get("/:id", (c) => {
  const row = store.read().templates.find((t) => t.id === c.req.param("id"));
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json({ template: serializeMessageTemplate(row) });
});

scaleMessageTemplates.post("/:id/assets", async (c) => {
  const templateId = c.req.param("id");
  const template = store.read().templates.find((row) => row.id === templateId);
  if (!template) return c.json({ error: "not found" }, 404);

  let body: { filename?: string; mimeType?: string; contentBase64?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }

  const filename = String(body.filename ?? "").trim();
  const mimeType = String(body.mimeType ?? "application/octet-stream").trim();
  const contentBase64 = String(body.contentBase64 ?? "").trim();
  if (!filename || !contentBase64) {
    return c.json({ error: "filename and contentBase64 required" }, 400);
  }

  const key = newsletterAssetKey(templateId, filename);
  const storedFilename = key.slice(templateId.length + 1);
  store.update((draft) => {
    draft.templateAssets = draft.templateAssets.filter((a) => a.key !== key);
    draft.templateAssets.push({
      id: newId("asset"),
      key,
      templateId,
      filename: storedFilename,
      mimeType,
      contentBase64,
      createdAt: new Date().toISOString(),
    });
  });

  const url = `${SCALE_PUBLIC_BASE_URL}/scale/assets/template/${encodeURIComponent(templateId)}/${encodeURIComponent(storedFilename)}`;
  return c.json({ url, key });
});

scaleMessageTemplates.post("/", async (c) => {
  let body: {
    name?: string;
    subject?: string;
    previewText?: string | null;
    bodyMarkdown?: string;
    layoutId?: string | null;
    category?: string;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }
  const name = body.name?.trim();
  if (!name) return c.json({ error: "name is required" }, 400);

  const id = newId("msgtpl");
  const now = new Date().toISOString();
  store.update((draft) => {
    draft.templates.push({
      id,
      accountLinkId: DEV_ACCOUNT_LINK_ID,
      name,
      subject: body.subject?.trim() ?? "",
      previewText: body.previewText ?? null,
      bodyMarkdown: body.bodyMarkdown ?? "",
      layoutId: body.layoutId ?? "tpl-minimal",
      templateVariables: {},
      category:
        body.category === "marketing" ||
        body.category === "newsletter" ||
        body.category === "conversational"
          ? body.category
          : "transactional",
      isPreset: false,
      createdAt: now,
      updatedAt: now,
    });
  });

  const row = store.read().templates.find((t) => t.id === id)!;
  return c.json({ template: serializeMessageTemplate(row) }, 201);
});

scaleMessageTemplates.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = store.read().templates.find((t) => t.id === id);
  if (!existing) return c.json({ error: "not found" }, 404);

  let body: {
    name?: string;
    subject?: string;
    previewText?: string | null;
    bodyMarkdown?: string;
    layoutId?: string | null;
    templateVariables?: Record<string, string>;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }

  const now = new Date().toISOString();
  store.update((draft) => {
    patchMessageTemplate(
      draft,
      id,
      {
        name: body.name?.trim(),
        subject: body.subject,
        previewText: body.previewText,
        bodyMarkdown: body.bodyMarkdown,
        layoutId: body.layoutId,
        templateVariables:
          body.templateVariables !== undefined
            ? sanitizeTemplateVariables(body.templateVariables)
            : undefined,
      },
      now,
    );
  });

  const row = store.read().templates.find((t) => t.id === id)!;
  return c.json({ template: serializeMessageTemplate(row) });
});
