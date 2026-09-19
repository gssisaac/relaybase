import type { Message, StudioDataStore } from "../../db/types";
import { newId } from "../shared/ids";
import { templateCatalogStore } from "../templates/template-catalog-store";
import { messageFileStore } from "./message-file-store";
import { messageIdForOwner } from "./resolve";

function syncMessageToDraft(draft: StudioDataStore, row: Message) {
  const idx = draft.messages.findIndex((m) => m.id === row.id);
  if (idx >= 0) draft.messages[idx] = row;
  else draft.messages.push(row);
}

export function createMessage(
  draft: StudioDataStore,
  input: {
    accountLinkId: string;
    name: string;
    subject?: string;
    previewText?: string | null;
    bodyMarkdown?: string;
    layoutId?: string | null;
    templateVariables?: Record<string, string>;
    forkedFromTemplateId?: string | null;
  },
  now: string,
): Message {
  const id = newId("msg");
  const row: Message = {
    id,
    accountLinkId: input.accountLinkId,
    name: input.name,
    subject: input.subject ?? "",
    previewText: input.previewText ?? null,
    bodyMarkdown: input.bodyMarkdown ?? "",
    layoutId: input.layoutId ?? "tpl-minimal",
    templateVariables: input.templateVariables ?? {},
    forkedFromTemplateId: input.forkedFromTemplateId ?? null,
    createdAt: now,
    updatedAt: now,
  };
  messageFileStore.save(row);
  syncMessageToDraft(draft, row);
  return row;
}

/** One message per owner (newsletter id, trigger id, …) — stable id for embeds. */
export function createMessageForOwner(
  draft: StudioDataStore,
  input: {
    ownerId: string;
    accountLinkId: string;
    name: string;
    layoutId?: string | null;
  },
  now: string,
): Message {
  const id = messageIdForOwner(input.ownerId);
  const existing = messageFileStore.findById(id);
  if (existing) {
    syncMessageToDraft(draft, existing);
    return existing;
  }

  const row: Message = {
    id,
    accountLinkId: input.accountLinkId,
    name: input.name,
    subject: "",
    previewText: null,
    bodyMarkdown: "",
    layoutId: input.layoutId ?? "tpl-minimal",
    templateVariables: {},
    forkedFromTemplateId: null,
    createdAt: now,
    updatedAt: now,
  };
  messageFileStore.save(row);
  syncMessageToDraft(draft, row);
  return row;
}

export function forkMessageFromTemplate(
  draft: StudioDataStore,
  templateId: string,
  input: {
    accountLinkId: string;
    name?: string;
  },
  now: string,
): Message | null {
  const catalog = templateCatalogStore.findById(templateId);
  if (!catalog) return null;

  return createMessage(
    draft,
    {
      accountLinkId: input.accountLinkId,
      name: input.name?.trim() || catalog.name,
      subject: catalog.subject,
      previewText: catalog.previewText ?? null,
      bodyMarkdown: catalog.bodyMarkdown,
      layoutId: catalog.layoutId,
      templateVariables: { ...(catalog.templateVariables ?? {}) },
      forkedFromTemplateId: catalog.id,
    },
    now,
  );
}

/** PATCH bodies still send layout id as `templateId`. */
export function patchMessage(
  draft: StudioDataStore,
  messageId: string,
  patch: {
    name?: string;
    subject?: string;
    previewText?: string | null;
    bodyMarkdown?: string;
    /** Layout id from API (`templateId` on broadcast/automation). */
    layoutId?: string | null;
    templateVariables?: Record<string, string>;
  },
  now: string,
): void {
  const row = messageFileStore.findById(messageId);
  if (!row) return;
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.subject !== undefined) row.subject = patch.subject;
  if (patch.previewText !== undefined) row.previewText = patch.previewText;
  if (patch.bodyMarkdown !== undefined) row.bodyMarkdown = patch.bodyMarkdown;
  if (patch.layoutId !== undefined) row.layoutId = patch.layoutId;
  if (patch.templateVariables !== undefined) row.templateVariables = patch.templateVariables;
  row.updatedAt = now;
  messageFileStore.save(row);
  syncMessageToDraft(draft, row);
}
