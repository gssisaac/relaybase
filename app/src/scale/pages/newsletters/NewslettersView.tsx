"use client";

import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import {
  newsletterDetailFromSearch,
  newslettersSectionFromLocation,
} from "@/scale/lib/paths";
import { NewsletterDetailProvider } from "@/scale/pages/newsletters/NewsletterDetailContext";
import { NewsletterDetailSwitch } from "@/scale/pages/newsletters/NewsletterDetailSwitch";
import { NewsletterInProgressView } from "@/scale/pages/newsletters/NewsletterInProgressView";
import { NewsletterSentOverviewView } from "@/scale/pages/newsletters/NewsletterSentOverviewView";
import { NewslettersListView } from "@/scale/pages/newsletters/NewslettersListView";

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
