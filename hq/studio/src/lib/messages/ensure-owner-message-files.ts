import type { Message, StudioDataStore } from "@db/types";
import { requireMessage } from "@lib/messages/resolve";

function materializeOwnerMessage(
  messageId: string,
  name: string,
  accountLinkId: string,
  createdAt: string,
  now: string,
): Message {
  return {
    id: messageId,
    accountLinkId,
    name,
    subject: "",
    previewText: null,
    bodyMarkdown: "",
    layoutId: "tpl-minimal",
    templateVariables: {},
    forkedFromTemplateId: null,
    createdAt,
    updatedAt: now,
  };
}

/** Recreate message bodies when store references `msgtpl_*` ids but rows are missing. */
export function ensureOwnerMessageFiles(store: StudioDataStore): boolean {
  const now = new Date().toISOString();
  let repaired = false;

  const ensure = (messageId: string | undefined, name: string, accountLinkId: string, createdAt: string) => {
    if (!messageId?.startsWith("msgtpl_")) return;
    if (store.messages.some((m) => m.id === messageId)) return;
    store.messages.push(materializeOwnerMessage(messageId, name, accountLinkId, createdAt, now));
    repaired = true;
  };

  for (const row of store.triggers) {
    ensure(row.messageId, row.name, row.accountLinkId, row.createdAt);
  }
  for (const row of store.newsletters) {
    const subject = row.messageId ? requireMessage(store, row.messageId).subject : "";
    ensure(row.messageId, subject.trim() || row.id, row.accountLinkId, row.createdAt);
  }

  return repaired;
}
