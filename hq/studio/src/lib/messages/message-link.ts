import { DEV_ACCOUNT_LINK_ID } from "../../db/store";
import type { StudioDataStore } from "../../db/types";

export type MessageLinkedOwner = {
  kind: "trigger" | "newsletter";
  id: string;
  name: string;
};

const MESSAGE_OWNER_PREFIX = "msgtpl_";

/** Owner entity id embedded in `msgtpl_{ownerId}` message ids. */
export function ownerIdFromMessageId(messageId: string): string | null {
  if (!messageId.startsWith(MESSAGE_OWNER_PREFIX)) return null;
  const ownerId = messageId.slice(MESSAGE_OWNER_PREFIX.length).trim();
  return ownerId || null;
}

export function resolveMessageLinkedOwner(
  data: StudioDataStore,
  messageId: string,
): MessageLinkedOwner | null {
  const ownerId = ownerIdFromMessageId(messageId);
  if (!ownerId) return null;

  const trigger = data.triggers.find(
    (row) => row.accountLinkId === DEV_ACCOUNT_LINK_ID && row.id === ownerId,
  );
  if (trigger) {
    return { kind: "trigger", id: trigger.id, name: trigger.name };
  }

  const newsletter = data.newsletters.find(
    (row) => row.accountLinkId === DEV_ACCOUNT_LINK_ID && row.id === ownerId,
  );
  if (newsletter) {
    return { kind: "newsletter", id: newsletter.id, name: newsletter.name };
  }

  return null;
}
