import fs from "node:fs";
import path from "node:path";

import type { Message, StudioDataStore } from "../../db/types";
import { messageFileStore } from "./message-file-store";

function messageYamlPath(messageId: string): string {
  return path.join(messageFileStore.dataDir, `${messageId}.yaml`);
}

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

/** Recreate YAML bodies when store.json references `msgtpl_*` ids but files were removed. */
export function ensureOwnerMessageFiles(store: StudioDataStore): boolean {
  const now = new Date().toISOString();
  let repaired = false;

  const ensure = (messageId: string | undefined, name: string, accountLinkId: string, createdAt: string) => {
    if (!messageId?.startsWith("msgtpl_")) return;
    if (fs.existsSync(messageYamlPath(messageId))) return;
    messageFileStore.save(materializeOwnerMessage(messageId, name, accountLinkId, createdAt, now));
    repaired = true;
  };

  for (const row of store.triggers) {
    ensure(row.messageId, row.name, row.accountLinkId, row.createdAt);
  }
  for (const row of store.newsletters) {
    ensure(row.messageId, row.name, row.accountLinkId, row.createdAt);
  }

  return repaired;
}
