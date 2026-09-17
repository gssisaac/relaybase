import type { PreviewPersonaId } from "@/studio/lib/newsletters/newsletter-merge-tags";
import { STUDIO_PUBLIC_LINK_ORIGIN } from "@/studio/lib/studio-origin";
import type { NewsletterMember } from "@/studio/api";

export function buildPreviewUnsubscribeUrl(
  newsletterId: string,
  personaId: PreviewPersonaId,
  members: NewsletterMember[],
): string {
  const base = STUDIO_PUBLIC_LINK_ORIGIN.replace(/\/$/, "");
  if (personaId.startsWith("member:")) {
    const memberId = personaId.slice("member:".length);
    const member = members.find(
      (m) => m.audienceMemberId === memberId || m.id === memberId,
    );
    if (member?.unsubscribeToken) {
      return `${base}/studio/unsubscribe/${encodeURIComponent(newsletterId)}/${encodeURIComponent(member.unsubscribeToken)}`;
    }
  }
  return `${base}/studio/unsubscribe/${encodeURIComponent(newsletterId)}/preview`;
}
