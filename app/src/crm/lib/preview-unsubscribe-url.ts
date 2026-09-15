import type { PreviewPersonaId } from "@/crm/lib/broadcast-merge-tags";
import { CRM_PUBLIC_LINK_ORIGIN } from "@/lib/crm/crm-origin";
import type { BroadcastMember } from "@/lib/crm/api";

export function buildPreviewUnsubscribeUrl(
  broadcastId: string,
  personaId: PreviewPersonaId,
  members: BroadcastMember[],
): string {
  const base = CRM_PUBLIC_LINK_ORIGIN.replace(/\/$/, "");
  if (personaId.startsWith("member:")) {
    const memberId = personaId.slice("member:".length);
    const member = members.find(
      (m) => m.audienceMemberId === memberId || m.id === memberId,
    );
    if (member?.unsubscribeToken) {
      return `${base}/crm/unsubscribe/${encodeURIComponent(broadcastId)}/${encodeURIComponent(member.unsubscribeToken)}`;
    }
  }
  return `${base}/crm/unsubscribe/${encodeURIComponent(broadcastId)}/preview`;
}
