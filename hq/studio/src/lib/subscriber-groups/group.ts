import { DEV_ACCOUNT_LINK_ID, store } from "../../db/store";
import type { SubscriberGroup } from "../../db/types";

export function findSubscriberGroup(groupId: string): SubscriberGroup | undefined {
  return store
    .read()
    .subscriberGroups.find((g) => g.id === groupId && g.accountLinkId === DEV_ACCOUNT_LINK_ID);
}
