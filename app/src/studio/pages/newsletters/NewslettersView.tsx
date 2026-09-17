"use client";

import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import {
  newsletterDetailFromSearch,
  newslettersSectionFromLocation,
} from "@/studio/lib/paths";
import { NewsletterDetailProvider } from "@/studio/stores/newsletter-detail";
import { NewsletterDetailSwitch } from "@/studio/pages/newsletters/NewsletterDetailSwitch";
import { NewsletterInProgressView } from "@/studio/pages/newsletters/NewsletterInProgressView";
import { NewsletterSentOverviewView } from "@/studio/pages/newsletters/NewsletterSentOverviewView";
import { NewslettersListView } from "@/studio/pages/newsletters/NewslettersListView";

function NewslettersRoute() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const detail = newsletterDetailFromSearch(searchParams);

  if (detail) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <NewsletterDetailProvider key={detail.newsletterId} newsletterId={detail.newsletterId}>
          <NewsletterDetailSwitch tab={detail.tab} />
        </NewsletterDetailProvider>
      </div>
    );
  }

  const section = newslettersSectionFromLocation(pathname, searchParams);
  if (section === "sent") return <NewsletterSentOverviewView />;
  if (section === "in-progress") return <NewsletterInProgressView />;
  return <NewslettersListView />;
}

export function NewslettersView() {
  return (
    <Suspense
      fallback={
        <div className="p-4 text-sm text-muted-foreground">Loading…</div>
      }
    >
      <NewslettersRoute />
    </Suspense>
  );
}
