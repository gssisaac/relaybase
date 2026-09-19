import { Hono } from "hono";
import {
  accountService,
  assetService,
  DEV_ACCOUNT_LINK_ID,
  messageService,
  newsletterService,
  studioDocumentService,
  templateService,
} from "@services/index";

import { resolveWorkerSendCredentials } from "@lib/mail/credentials";
import { sendMail } from "@lib/mail/sender";
import {
  buildListUnsubscribeUrl,
  renderNewsletterForRecipient,
  resolveBroadcastSubject,
} from "@lib/render/render";
import { isValidEmail } from "@lib/shared/email";
import { newId, newToken } from "@lib/shared/ids";
import { STUDIO_PUBLIC_BASE_URL } from "@lib/shared/studio-url";
export const studioMessages = new Hono();

studioMessages.get("/", (c) => {
  const rows = messageService
    .listForGallery()
    .filter((m) => m.accountLinkId === DEV_ACCOUNT_LINK_ID);
  return c.json({ messages: rows.map((row) => messageService.serializeMessage(row)) });
});

studioMessages.get("/:id", (c) => {
  const row = messageService.findById(c.req.param("id"));
  if (!row || row.accountLinkId !== DEV_ACCOUNT_LINK_ID) {
    return c.json({ error: "not found" }, 404);
  }
  return c.json({ message: messageService.serializeMessage(row) });
});

studioMessages.post("/", async (c) => {
  let body: {
    name?: string;
    subject?: string;
    previewText?: string | null;
    bodyMarkdown?: string;
    layoutId?: string | null;
    forkedFromTemplateId?: string | null;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }
  const name = body.name?.trim();
  if (!name) return c.json({ error: "name is required" }, 400);

  const now = new Date().toISOString();
  const created = studioDocumentService.mutate((draft) =>
    messageService.create(
      draft,
      {
        accountLinkId: DEV_ACCOUNT_LINK_ID,
        name,
        subject: body.subject?.trim(),
        previewText: body.previewText ?? null,
        bodyMarkdown: body.bodyMarkdown ?? "",
        layoutId: body.layoutId ?? "tpl-minimal",
        forkedFromTemplateId: body.forkedFromTemplateId ?? null,
      },
      now,
    ),
  );

  const row = created.messages.find((m) => m.name === name && m.updatedAt === now)!;
  return c.json({ message: messageService.serializeMessage(row) }, 201);
});

studioMessages.post("/:id/assets", async (c) => {
  const messageId = c.req.param("id");
  const message = messageService.findById(messageId);
  if (!message) return c.json({ error: "not found" }, 404);

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

  const key = assetService.newsletterAssetKey(messageId, filename);
  const storedFilename = key.slice(messageId.length + 1);
  studioDocumentService.mutate((draft) => {
    if (!draft.messageAssets) draft.messageAssets = [];
    draft.messageAssets = draft.messageAssets.filter((a) => a.key !== key);
    draft.messageAssets.push({
      id: newId("asset"),
      key,
      messageId,
      filename: storedFilename,
      mimeType,
      contentBase64,
      createdAt: new Date().toISOString(),
    });
  });

  const url = `${STUDIO_PUBLIC_BASE_URL}/studio/assets/message/${encodeURIComponent(messageId)}/${encodeURIComponent(storedFilename)}`;
  return c.json({ url, key });
});

studioMessages.post("/:id/test-send", async (c) => {
  const id = c.req.param("id");
  if (!messageService.findById(id)) return c.json({ error: "not found" }, 404);

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
  if (!to || !isValidEmail(to)) {
    return c.json({ error: "Please enter a valid email address" }, 400);
  }
  const fromEmail = body.fromEmail?.trim();
  if (!fromEmail || !isValidEmail(fromEmail)) {
    return c.json({ error: "Select a valid sender email" }, 400);
  }

  const sendAuth = resolveWorkerSendCredentials();
  if (!sendAuth.ok) {
    return c.json({ error: sendAuth.error }, 502);
  }

  const message = messageService.requireMessage(studioDocumentService.read(), id);
  const layoutId = message.layoutId ?? "tpl-minimal";
  const templateHtml = newsletterService.layoutHtml(layoutId) ?? "<div>{{content}}</div>";
  const mergeTags: Record<string, string> = {
    ...(body.mergeTags ?? {}),
    "contact.email": body.mergeTags?.["contact.email"]?.trim() || to,
  };
  const recipientName = messageService.recipientDisplayName(mergeTags, to);

  const data = studioDocumentService.read();
  const defaultComplianceId = accountService.defaultComplianceIdentityId(data);
  const orgName = defaultComplianceId
    ? accountService.complianceSettingsFromIdentity(accountService.findComplianceIdentity(defaultComplianceId)).organizationName
    : null;
  const resolvedTemplateVariables = templateService.resolveVariableDefaults({
    schema: newsletterService.layoutSchema(layoutId),
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
    templateVariablesSchema: newsletterService.layoutSchema(layoutId),
    templateVariables: resolvedTemplateVariables,
    recipient: { email: to, name: recipientName },
    unsubscribeToken,
    studioBaseUrl: STUDIO_PUBLIC_BASE_URL,
  });
  const listUnsubscribeUrl = buildListUnsubscribeUrl(STUDIO_PUBLIC_BASE_URL, id, unsubscribeToken);
  const subjectWithLayoutVars = resolveBroadcastSubject({
    subject: message.subject,
    templateVariablesSchema: newsletterService.layoutSchema(layoutId),
    templateVariables: resolvedTemplateVariables,
    recipient: { email: to, name: recipientName },
    broadcastId: id,
    unsubscribeToken,
    studioBaseUrl: STUDIO_PUBLIC_BASE_URL,
  });
  const subject = messageService.applyMergeTags(subjectWithLayoutVars, mergeTags);
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

studioMessages.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = messageService.findById(id);
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
  studioDocumentService.mutate((draft) => {
    messageService.patch(
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
            ? templateService.sanitizeVariables(body.templateVariables)
            : undefined,
      },
      now,
    );
  });

  const row = messageService.findById(id)!;
  return c.json({ message: messageService.serializeMessage(row) });
});

studioMessages.delete("/:id", (c) => {
  const id = c.req.param("id");
  if (!messageService.findById(id)) return c.json({ error: "not found" }, 404);

  messageService.delete(id);
  studioDocumentService.mutate((draft) => {
    draft.messageAssets = (draft.messageAssets ?? []).filter((a) => a.messageId !== id);
    draft.messages = draft.messages.filter((m) => m.id !== id);
  });

  return c.json({ ok: true });
});
