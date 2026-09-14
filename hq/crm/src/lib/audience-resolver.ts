import { DEV_ACCOUNT_LINK_ID, store } from "../db/store";
import type { AudienceMember, Broadcast } from "../db/types";
import { isEmailSuppressedForGroup } from "./account-suppression";
import { findAudienceGroup } from "./broadcast-audience-sync";

export function findAudienceContactInGroup(
  groupId: string,
  contactId: string,
): AudienceMember | undefined {
  const group = findAudienceGroup(groupId);
  return group?.contacts.find((c) => c.id === contactId);
}

export function findAudienceContactByUnsubscribeToken(
  groupId: string,
  token: string,
): AudienceMember | undefined {
  const group = findAudienceGroup(groupId);
  return group?.contacts.find((c) => c.unsubscribeToken === token);
}

/** Contacts eligible to receive a broadcast at send time (live audience group). */
export function resolveActiveAudienceContacts(broadcast: Broadcast): AudienceMember[] {
  const group = broadcast.audienceGroupId ? findAudienceGroup(broadcast.audienceGroupId) : undefined;
  if (!group) return [];

  const seen = new Set<string>();
  const eligible: AudienceMember[] = [];
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

export function audienceActiveCountForBroadcast(broadcast: Broadcast): number {
  return resolveActiveAudienceContacts(broadcast).length;
}

export function listAudienceContactsForBroadcast(
  broadcastId: string,
  filters?: { status?: string; q?: string },
): Array<AudienceMember & { audienceGroupId: string }> {
  const broadcast = store
    .read()
    .broadcasts.find((b) => b.id === broadcastId && b.accountLinkId === DEV_ACCOUNT_LINK_ID);
  if (!broadcast?.audienceGroupId) return [];

  const group = findAudienceGroup(broadcast.audienceGroupId);
  if (!group) return [];

  let rows = group.contacts.map((c) => ({ ...c, audienceGroupId: group.id }));
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
