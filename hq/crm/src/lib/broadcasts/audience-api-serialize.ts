import type { AudienceMember } from "../../db/types";

export function serializeBroadcastAudienceContact(
  broadcastId: string,
  contact: AudienceMember,
) {
  return {
    id: contact.id,
    broadcastId,
    audienceMemberId: contact.id,
    email: contact.email,
    name: contact.name,
    status: contact.sendStatus,
    source: contact.source,
    unsubscribedAt: contact.unsubscribedAt,
    bouncedAt: contact.bouncedAt ?? null,
    bounceReason: contact.bounceReason ?? null,
    addedAt: contact.addedAt,
  };
}
