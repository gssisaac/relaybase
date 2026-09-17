"use client";

import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import {
  newsletterDetailFromSearch,
  newslettersSectionFromLocation,
} from "@/studio/lib/paths";
import { LegacyNewsletterQueryRedirect } from "@/studio/pages/newsletters/NewsletterDetailRedirects";
import { NewsletterInProgressView } from "@/studio/pages/newsletters/NewsletterInProgressView";
import { NewsletterSentOverviewView } from "@/studio/pages/newsletters/NewsletterSentOverviewView";
import { NewslettersRouteFallbackSkeleton } from "@/studio/components/newsletters/NewsletterLoadingSkeletons";
import { NewsletterCloudflareLimitsAlertProvider } from "@/studio/components/newsletters/NewsletterCloudflareLimitsAlert";
import { NewslettersHubProvider } from "@/studio/stores/newsletters-hub";
import { NewslettersListView } from "@/studio/pages/newsletters/NewslettersListView";

function NewslettersRoute() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const detail = newsletterDetailFromSearch(searchParams);

  if (detail) {
    return (
      <LegacyNewsletterQueryRedirect
        newsletterId={detail.newsletterId}
        tab={detail.tab}
      />
    );
  }

  const section = newslettersSectionFromLocation(pathname, searchParams);
  if (section === "sent") return <NewsletterSentOverviewView />;
  if (section === "in-progress") return <NewsletterInProgressView />;
  return <NewslettersListView />;
}

export function NewslettersView() {
  return (
    <NewslettersHubProvider>
      <NewsletterCloudflareLimitsAlertProvider>
        <Suspense fallback={<NewslettersRouteFallbackSkeleton />}>
          <NewslettersRoute />
        </Suspense>
      </NewsletterCloudflareLimitsAlertProvider>
    </NewslettersHubProvider>
  );
}
