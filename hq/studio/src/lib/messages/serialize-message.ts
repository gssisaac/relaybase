import { store } from "../../db/store";
import type { Message } from "../../db/types";
import { resolveMessageLinkedOwner } from "./message-link";

export function serializeMessage(row: Message) {
  const linkedOwner = resolveMessageLinkedOwner(store.read(), row.id);
  return {
    id: row.id,
    name: row.name,
    subject: row.subject,
    previewText: row.previewText ?? null,
    bodyMarkdown: row.bodyMarkdown,
    layoutId: row.layoutId ?? null,
    templateVariables: row.templateVariables ?? {},
    forkedFromTemplateId: row.forkedFromTemplateId ?? null,
    linkedOwner,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
