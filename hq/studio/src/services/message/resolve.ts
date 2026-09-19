import type { Layout, Message, StudioDataStore, Trigger } from "@db/types";
import { messageFileStore } from "@services/message/message-file-store";

export type ResolvedMessage = {
  subject: string;
  previewText: string | null;
  bodyMarkdown: string;
  layoutId: string | null;
  templateVariables: Record<string, string>;
};

/** Stable message id for an owning entity (newsletter, trigger, …). */
export function messageIdForOwner(ownerId: string): string {
  return `msgtpl_${ownerId}`;
}

export function findLayout(
  data: StudioDataStore,
  layoutId: string | null | undefined,
): Layout | undefined {
  if (!layoutId) return undefined;
  return data.layouts.find((l) => l.id === layoutId);
}

export function findMessage(_data: StudioDataStore, id: string): Message | undefined {
  return messageFileStore.findById(id);
}

export function requireMessage(data: StudioDataStore, messageId: string): ResolvedMessage {
  return (
    resolveMessage(data, messageId) ?? {
      subject: "",
      previewText: null,
      bodyMarkdown: "",
      layoutId: "tpl-minimal",
      templateVariables: {},
    }
  );
}

export function resolveMessage(data: StudioDataStore, messageId: string): ResolvedMessage | null {
  const row = findMessage(data, messageId);
  if (!row) return null;
  return {
    subject: row.subject,
    previewText: row.previewText ?? null,
    bodyMarkdown: row.bodyMarkdown,
    layoutId: row.layoutId ?? null,
    templateVariables: row.templateVariables ?? {},
  };
}

export function triggerSource(row: Trigger): Trigger["source"] {
  return row.source;
}

export function getLayoutHtml(data: StudioDataStore, layoutId: string | null | undefined): string | null {
  return findLayout(data, layoutId)?.htmlSource ?? null;
}

export function getLayoutSchema(data: StudioDataStore, layoutId: string | null | undefined) {
  return findLayout(data, layoutId)?.variablesSchema ?? null;
}

export function rowMessageId(row: { messageId: string }): string {
  return row.messageId;
}
