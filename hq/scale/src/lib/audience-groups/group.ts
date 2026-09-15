import { DEV_ACCOUNT_LINK_ID, store } from "../../db/store";
import type { AudienceGroup } from "../../db/types";

export function findAudienceGroup(groupId: string): AudienceGroup | undefined {
  return store
    .read()
    .audienceGroups.find((g) => g.id === groupId && g.accountLinkId === DEV_ACCOUNT_LINK_ID);
}
