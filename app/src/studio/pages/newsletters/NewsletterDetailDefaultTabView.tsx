"use client";

import { defaultNewsletterDetailTab } from "@/studio/lib/newsletters/newsletter-detail-nav";
import { NewsletterContentView } from "@/studio/pages/newsletters/NewsletterContentView";
import { NewsletterPublishView } from "@/studio/pages/newsletters/NewsletterPublishView";
import { NewsletterSettingsView } from "@/studio/pages/newsletters/NewsletterSettingsView";
import { NewsletterStatsView } from "@/studio/pages/newsletters/NewsletterStatsView";
import { NewsletterSubscribersView } from "@/studio/pages/newsletters/NewsletterSubscribersView";
import { useNewsletterDetail } from "@/studio/stores/newsletter-detail";

export function NewsletterDetailDefaultTabView() {
  const { newsletter } = useNewsletterDetail();
  if (!newsletter) return null;

  const tab = defaultNewsletterDetailTab(newsletter.status);
  if (tab === "publish") return <NewsletterPublishView />;
  if (tab === "recipients") return <NewsletterSubscribersView />;
  if (tab === "stats") return <NewsletterStatsView />;
  if (tab === "settings") return <NewsletterSettingsView />;
  return <NewsletterContentView />;
}
