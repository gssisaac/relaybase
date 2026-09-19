import { DEV_ACCOUNT_LINK_ID, studioService } from "@services/studio-service";
import type { SubscriberGroup } from "@db/types";

export function findSubscriberGroup(groupId: string): SubscriberGroup | undefined {
  return studioService
    .read()
    .subscriberGroups.find((g) => g.id === groupId && g.accountLinkId === DEV_ACCOUNT_LINK_ID);
}
