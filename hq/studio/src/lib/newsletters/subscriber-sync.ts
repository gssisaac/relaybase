import { findSubscriberGroup } from "@lib/subscriber-groups/group";

export { findSubscriberGroup };

/** Subscribers are live on the linked group — sync only reports current contact count. */
export function refreshNewsletterSubscriberLink(
  broadcastId: string,
  groupId: string,
): { contactCount: number; activeCount: number } {
  const group = findSubscriberGroup(groupId);
  if (!group) return { contactCount: 0, activeCount: 0 };
  const activeCount = group.contacts.filter((c) => c.sendStatus === "active").length;
  void broadcastId;
  return { contactCount: group.contacts.length, activeCount };
}

export function syncAllNewslettersForSubscriberGroup(_groupId: string): void {
  /* no-op: newsletters read subscribers from the group at send time */
}
