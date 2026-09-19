import type { Layout } from "@db/types";
import { messageFileStore } from "@lib/messages/message-file-store";
import { DEV_ACCOUNT_LINK_ID } from "@services/studio/constants";

export function canAccessCustomLayout(row: Layout): boolean {
  return row.accountLinkId === DEV_ACCOUNT_LINK_ID || row.accountLinkId === null;
}

export function nextCustomForkName(layouts: Layout[], baseName: string): string {
  const first = `${baseName} (custom)`;
  if (!layouts.some((t) => t.name === first)) return first;
  let n = 2;
  while (layouts.some((t) => t.name === `${baseName} (custom ${n})`)) n += 1;
  return `${baseName} (custom ${n})`;
}

export function layoutReferencedByMessages(layoutId: string): boolean {
  return messageFileStore.layoutIsReferenced(layoutId);
}
