import type { PreviewPersonaId } from "@/scale/lib/broadcast-merge-tags";
import { SCALE_PUBLIC_LINK_ORIGIN } from "@/lib/scale/scale-origin";
import type { BroadcastMember } from "@/lib/scale/api";

export function buildPreviewUnsubscribeUrl(
  broadcastId: string,
  personaId: PreviewPersonaId,
  members: BroadcastMember[],
): string {
  const base = SCALE_PUBLIC_LINK_ORIGIN.replace(/\/$/, "");
  if (personaId.startsWith("member:")) {
    const memberId = personaId.slice("member:".length);
    const member = members.find(
      (m) => m.audienceMemberId === memberId || m.id === memberId,
    );
    if (member?.unsubscribeToken) {
      return `${base}/scale/unsubscribe/${encodeURIComponent(broadcastId)}/${encodeURIComponent(member.unsubscribeToken)}`;
    }
  }
  return `${base}/scale/unsubscribe/${encodeURIComponent(broadcastId)}/preview`;
}
