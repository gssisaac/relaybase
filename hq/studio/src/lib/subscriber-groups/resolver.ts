import type { SubscriberMember, Newsletter } from "@db/types";
import { isEmailSuppressedForGroup } from "@lib/account/suppression";
import { findSubscriberGroup } from "@lib/subscriber-groups/group";
import { DEV_ACCOUNT_LINK_ID } from "@services/studio/constants";
import { readStudioDocument } from "@services/studio/studio-document.service";

export function findSubscriberContactInGroup(
  groupId: string,
  contactId: string,
): SubscriberMember | undefined {
  const group = findSubscriberGroup(groupId);
  return group?.contacts.find((c) => c.id === contactId);
}

export function findSubscriberContactByUnsubscribeToken(
  groupId: string,
  token: string,
): SubscriberMember | undefined {
  const group = findSubscriberGroup(groupId);
  return group?.contacts.find((c) => c.unsubscribeToken === token);
}

/** Contacts eligible to receive a broadcast at send time (live subscriber group). */
export function resolveActiveSubscriberContacts(broadcast: Newsletter): SubscriberMember[] {
  const group = broadcast.subscriberGroupId ? findSubscriberGroup(broadcast.subscriberGroupId) : undefined;
  if (!group) return [];

  const seen = new Set<string>();
  const eligible: SubscriberMember[] = [];
  for (const c of group.contacts) {
    const email = c.email.trim().toLowerCase();
    if (seen.has(email)) continue;
    seen.add(email);
    if (c.sendStatus !== "active") continue;
    if (isEmailSuppressedForGroup(email, group.id, broadcast.accountLinkId)) continue;
    eligible.push(c);
  }
  return eligible;
}

export function subscriberActiveCountForNewsletter(broadcast: Newsletter): number {
  return resolveActiveSubscriberContacts(broadcast).length;
}

export function listSubscriberContactsForBroadcast(
  newsletterId: string,
  filters?: { status?: string; q?: string },
): Array<SubscriberMember & { subscriberGroupId: string }> {
  const broadcast = readStudioDocument()
    .newsletters.find((b) => b.id === newsletterId && b.accountLinkId === DEV_ACCOUNT_LINK_ID);
  if (!broadcast?.subscriberGroupId) return [];

  const group = findSubscriberGroup(broadcast.subscriberGroupId);
  if (!group) return [];

  let rows = group.contacts.map((c) => ({ ...c, subscriberGroupId: group.id }));
  if (filters?.status) {
    rows = rows.filter((c) => c.sendStatus === filters.status);
  }
  if (filters?.q) {
    const q = filters.q.toLowerCase();
    rows = rows.filter(
      (c) => c.email.includes(q) || (c.name ?? "").toLowerCase().includes(q),
    );
  }
  return rows.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
}
