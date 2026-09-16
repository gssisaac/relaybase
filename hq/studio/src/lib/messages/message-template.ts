import type { StudioDataStore, Template, TemplateCategory } from "../../db/types";
import { templateFileStore } from "../templates/template-file-store";
import { messageTemplateIdForOwner } from "./resolve";

function syncTemplateToDraft(draft: StudioDataStore, tpl: Template) {
  const idx = draft.templates.findIndex((t) => t.id === tpl.id);
  if (idx >= 0) draft.templates[idx] = tpl;
  else draft.templates.push(tpl);
}

export function createMessageTemplate(
  draft: StudioDataStore,
  input: {
    ownerId: string;
    accountLinkId: string;
    name: string;
    category?: TemplateCategory;
    layoutId?: string | null;
  },
  now: string,
): Template {
  const id = messageTemplateIdForOwner(input.ownerId);
  const existing = templateFileStore.findById(id);
  if (existing) {
    syncTemplateToDraft(draft, existing);
    return existing;
  }

  const tpl: Template = {
    id,
    accountLinkId: input.accountLinkId,
    name: input.name,
    subject: "",
    previewText: null,
    bodyMarkdown: "",
    layoutId: input.layoutId ?? "tpl-minimal",
    templateVariables: {},
    category: input.category,
    isPreset: false,
    createdAt: now,
    updatedAt: now,
  };
  templateFileStore.save(tpl);
  syncTemplateToDraft(draft, tpl);
  return tpl;
}

/** PATCH bodies still send layout id as `templateId`. */
export function patchMessageTemplate(
  draft: StudioDataStore,
  messageTemplateId: string,
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
  const tpl = templateFileStore.findById(messageTemplateId);
  if (!tpl) return;
  if (patch.name !== undefined) tpl.name = patch.name;
  if (patch.subject !== undefined) tpl.subject = patch.subject;
  if (patch.previewText !== undefined) tpl.previewText = patch.previewText;
  if (patch.bodyMarkdown !== undefined) tpl.bodyMarkdown = patch.bodyMarkdown;
  if (patch.layoutId !== undefined) tpl.layoutId = patch.layoutId;
  if (patch.templateVariables !== undefined) tpl.templateVariables = patch.templateVariables;
  tpl.updatedAt = now;
  templateFileStore.save(tpl);
  syncTemplateToDraft(draft, tpl);
}
