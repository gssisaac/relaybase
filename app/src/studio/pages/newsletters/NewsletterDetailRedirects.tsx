"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { normalizeNewsletterDetailTab } from "@/studio/lib/newsletters/newsletter-detail-nav";
import {
  newsletterDetailFromPathname,
  newsletterDetailHref,
  type NewsletterDetailTab,
} from "@/studio/lib/paths";
import { useNewsletterDetail } from "@/studio/stores/newsletter-detail";

export function NewsletterDetailTabRedirect() {
  const router = useRouter();
  const pathname = usePathname();
  const { newsletterId, newsletter } = useNewsletterDetail();
  const fromPath = newsletterDetailFromPathname(pathname);

  useEffect(() => {
    if (!newsletter || !fromPath?.tab) return;
    const resolved = normalizeNewsletterDetailTab(fromPath.tab, newsletter.status);
    if (resolved !== fromPath.tab) {
      router.replace(newsletterDetailHref(newsletterId, resolved, newsletter.status));
    }
  }, [fromPath?.tab, newsletter, newsletterId, router]);

  return null;
}

export function LegacyNewsletterQueryRedirect({
  newsletterId,
  tab,
}: {
  newsletterId: string;
  tab: NewsletterDetailTab | null;
}) {
  const router = useRouter();

  useEffect(() => {
    router.replace(newsletterDetailHref(newsletterId, tab ?? "content"));
  }, [newsletterId, router, tab]);

  return null;
}
