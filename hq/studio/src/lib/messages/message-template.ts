import type { StudioDataStore, Template, TemplateCategory } from "../../db/types";
import { messageTemplateIdForOwner } from "./resolve";

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
  const existing = draft.templates.find((t) => t.id === id);
  if (existing) return existing;

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
  draft.templates.push(tpl);
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
  const tpl = draft.templates.find((t) => t.id === messageTemplateId);
  if (!tpl) return;
  if (patch.name !== undefined) tpl.name = patch.name;
  if (patch.subject !== undefined) tpl.subject = patch.subject;
  if (patch.previewText !== undefined) tpl.previewText = patch.previewText;
  if (patch.bodyMarkdown !== undefined) tpl.bodyMarkdown = patch.bodyMarkdown;
  if (patch.layoutId !== undefined) tpl.layoutId = patch.layoutId;
  if (patch.templateVariables !== undefined) tpl.templateVariables = patch.templateVariables;
  tpl.updatedAt = now;
}
