import type { PreviewPersonaId } from "@/scale/lib/newsletters/newsletter-merge-tags";
import { SCALE_PUBLIC_LINK_ORIGIN } from "@/lib/scale/scale-origin";
import type { NewsletterMember } from "@/lib/scale/api";

export function buildPreviewUnsubscribeUrl(
  newsletterId: string,
  personaId: PreviewPersonaId,
  members: NewsletterMember[],
): string {
  const base = SCALE_PUBLIC_LINK_ORIGIN.replace(/\/$/, "");
  if (personaId.startsWith("member:")) {
    const memberId = personaId.slice("member:".length);
    const member = members.find(
      (m) => m.audienceMemberId === memberId || m.id === memberId,
    );
    if (member?.unsubscribeToken) {
      return `${base}/scale/unsubscribe/${encodeURIComponent(newsletterId)}/${encodeURIComponent(member.unsubscribeToken)}`;
    }
  }
  return `${base}/scale/unsubscribe/${encodeURIComponent(newsletterId)}/preview`;
}
