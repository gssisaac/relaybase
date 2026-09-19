import type { Newsletter, StudioDataStore } from "@db/types";
import { requireMessage } from "@lib/messages/resolve";

export function newsletterSubject(data: StudioDataStore, row: Newsletter): string {
  return requireMessage(data, row.messageId).subject ?? "";
}
