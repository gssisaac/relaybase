import { Hono } from "hono";

import { DEV_ACCOUNT_LINK_ID, store } from "../db/store";
import { newsletterAssetKey } from "../lib/assets/key";
import { resolveWorkerSendCredentials } from "../lib/mail/credentials";
import { sendMail } from "../lib/mail/sender";
import { patchMessageTemplate } from "../lib/messages/message-template";
import { requireMessage } from "../lib/messages/resolve";
import { serializeMessageTemplate } from "../lib/messages/serialize-template";
import {
  getNewsletterLayoutHtml,
  getNewsletterLayoutSchema,
} from "../lib/newsletters/serialize";
import {
  accountDefaultComplianceIdentityId,
  complianceSettingsFromIdentity,
  findComplianceIdentity,
} from "../lib/compliance/identity";
import { buildListUnsubscribeUrl, renderNewsletterForRecipient } from "../lib/render/render";
import { resolveTemplateVariableDefaults } from "../lib/templates/variable-schema";
import { newId, newToken } from "../lib/shared/ids";
import { STUDIO_PUBLIC_BASE_URL } from "../lib/shared/studio-url";
import { templateFileStore } from "../lib/templates/template-file-store";
import type { Template, TemplateCategory } from "../db/types";

export const studioMessageTemplates = new Hono();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function applyMergeTagValues(text: string, mergeTags: Record<string, string>): string {
  let out = text;
  for (const [key, value] of Object.entries(mergeTags)) {
    const k = key.trim();
    if (!k) continue;
    out = out.replaceAll(`{{${k}}}`, value);
  }
  return out;
}

function recipientDisplayName(mergeTags: Record<string, string>, email: string): string {
  const named = mergeTags["contact.name"]?.trim();
  if (named) return named;
  return email.split("@")[0]?.trim() || email;
}

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

studioMessageTemplates.get("/", (c) => {
  const rows = store
    .read()
    .templates.filter((t) => t.accountLinkId === DEV_ACCOUNT_LINK_ID || t.isPreset);
  return c.json({ templates: rows.map(serializeMessageTemplate) });
});

studioMessageTemplates.get("/:id", (c) => {
  const row = templateFileStore.findById(c.req.param("id"));
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json({ template: serializeMessageTemplate(row) });
});

studioMessageTemplates.post("/:id/assets", async (c) => {
  const templateId = c.req.param("id");
  const template = templateFileStore.findById(templateId);
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

  const url = `${STUDIO_PUBLIC_BASE_URL}/studio/assets/template/${encodeURIComponent(templateId)}/${encodeURIComponent(storedFilename)}`;
  return c.json({ url, key });
});

studioMessageTemplates.post("/", async (c) => {
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
  const category: TemplateCategory =
    body.category === "marketing" ||
    body.category === "newsletter" ||
    body.category === "conversational"
      ? body.category
      : "transactional";
  const tpl: Template = {
    id,
    accountLinkId: DEV_ACCOUNT_LINK_ID,
    name,
    subject: body.subject?.trim() ?? "",
    previewText: body.previewText ?? null,
    bodyMarkdown: body.bodyMarkdown ?? "",
    layoutId: body.layoutId ?? "tpl-minimal",
    templateVariables: {},
    category,
    isPreset: false,
    createdAt: now,
    updatedAt: now,
  };
  templateFileStore.save(tpl);

  const row = templateFileStore.findById(id)!;
  return c.json({ template: serializeMessageTemplate(row) }, 201);
});

studioMessageTemplates.post("/:id/test-send", async (c) => {
  const id = c.req.param("id");
  if (!templateFileStore.findById(id)) return c.json({ error: "not found" }, 404);

  let body: {
    to?: string;
    fromEmail?: string;
    fromName?: string | null;
    replyTo?: string | null;
    mergeTags?: Record<string, string>;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }

  const to = body.to?.trim();
  if (!to || !EMAIL_RE.test(to)) {
    return c.json({ error: "Please enter a valid email address" }, 400);
  }
  const fromEmail = body.fromEmail?.trim();
  if (!fromEmail || !EMAIL_RE.test(fromEmail)) {
    return c.json({ error: "Select a valid sender email" }, 400);
  }

  const sendAuth = resolveWorkerSendCredentials();
  if (!sendAuth.ok) {
    return c.json({ error: sendAuth.error }, 502);
  }

  const message = requireMessage(store.read(), id);
  const layoutId = message.layoutId ?? "tpl-minimal";
  const templateHtml = getNewsletterLayoutHtml(layoutId) ?? "<div>{{content}}</div>";
  const mergeTags: Record<string, string> = {
    ...(body.mergeTags ?? {}),
    "contact.email": body.mergeTags?.["contact.email"]?.trim() || to,
  };
  const recipientName = recipientDisplayName(mergeTags, to);

  const data = store.read();
  const defaultComplianceId = accountDefaultComplianceIdentityId(data);
  const orgName = defaultComplianceId
    ? complianceSettingsFromIdentity(findComplianceIdentity(defaultComplianceId)).organizationName
    : null;
  const resolvedTemplateVariables = resolveTemplateVariableDefaults({
    schema: getNewsletterLayoutSchema(layoutId),
    values: message.templateVariables,
    complianceOrganizationName: orgName,
  });

  const unsubscribeToken = newToken();
  const html = renderNewsletterForRecipient({
    broadcastId: id,
    recipientId: "test",
    bodyMarkdown: message.bodyMarkdown,
    templateId: layoutId,
    templateHtml,
    templateVariablesSchema: getNewsletterLayoutSchema(layoutId),
    templateVariables: resolvedTemplateVariables,
    recipient: { email: to, name: recipientName },
    unsubscribeToken,
    studioBaseUrl: STUDIO_PUBLIC_BASE_URL,
  });
  const listUnsubscribeUrl = buildListUnsubscribeUrl(STUDIO_PUBLIC_BASE_URL, id, unsubscribeToken);
  const subject = applyMergeTagValues(message.subject, mergeTags);
  const result = await sendMail({
    to,
    from: fromEmail,
    fromName: body.fromName?.trim() || null,
    replyTo: body.replyTo?.trim() || null,
    subject,
    html,
    listUnsubscribeUrl,
  });
  if (!result.ok) {
    return c.json({ error: result.error || "Worker rejected test send" }, 502);
  }
  return c.json({ ok: true });
});

studioMessageTemplates.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = templateFileStore.findById(id);
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

  const row = templateFileStore.findById(id)!;
  return c.json({ template: serializeMessageTemplate(row) });
});

studioMessageTemplates.delete("/:id", (c) => {
  const id = c.req.param("id");
  const existing = templateFileStore.findById(id);
  if (!existing) return c.json({ error: "not found" }, 404);
  if (existing.isPreset) {
    return c.json({ error: "Built-in templates cannot be deleted" }, 403);
  }

  templateFileStore.delete(id);
  store.update((draft) => {
    draft.templateAssets = draft.templateAssets.filter((a) => a.templateId !== id);
  });

  return c.json({ ok: true });
});
