import { findAudienceGroup } from "../audience-groups/group";

export { findAudienceGroup };

/** Audience is live on the linked group — sync only reports current contact count. */
export function refreshBroadcastAudienceLink(
  broadcastId: string,
  groupId: string,
): { contactCount: number; activeCount: number } {
  const group = findAudienceGroup(groupId);
  if (!group) return { contactCount: 0, activeCount: 0 };
  const activeCount = group.contacts.filter((c) => c.sendStatus === "active").length;
  void broadcastId;
  return { contactCount: group.contacts.length, activeCount };
}

export function syncAllBroadcastsForAudienceGroup(_groupId: string): void {
  /* no-op: broadcasts read audience from the group at send time */
}
