import type { SubscriberGroup } from "@db/types";
import { DEV_ACCOUNT_LINK_ID } from "@services/studio/constants";
import { readStudioDocument } from "@services/studio/studio-document.service";

export function findSubscriberGroup(groupId: string): SubscriberGroup | undefined {
  return readStudioDocument()
    .subscriberGroups.find((g) => g.id === groupId && g.accountLinkId === DEV_ACCOUNT_LINK_ID);
}
