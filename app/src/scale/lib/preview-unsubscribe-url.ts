import type { PreviewPersonaId } from "@/scale/lib/campaigns/campaign-merge-tags";
import { SCALE_PUBLIC_LINK_ORIGIN } from "@/lib/scale/scale-origin";
import type { CampaignMember } from "@/lib/scale/api";

export function buildPreviewUnsubscribeUrl(
  campaignId: string,
  personaId: PreviewPersonaId,
  members: CampaignMember[],
): string {
  const base = SCALE_PUBLIC_LINK_ORIGIN.replace(/\/$/, "");
  if (personaId.startsWith("member:")) {
    const memberId = personaId.slice("member:".length);
    const member = members.find(
      (m) => m.audienceMemberId === memberId || m.id === memberId,
    );
    if (member?.unsubscribeToken) {
      return `${base}/scale/unsubscribe/${encodeURIComponent(campaignId)}/${encodeURIComponent(member.unsubscribeToken)}`;
    }
  }
  return `${base}/scale/unsubscribe/${encodeURIComponent(campaignId)}/preview`;
}
