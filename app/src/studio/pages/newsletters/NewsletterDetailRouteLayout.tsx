"use client";

import type { ReactNode } from "react";

import { NewsletterCloudflareLimitsAlertProvider } from "@/studio/components/newsletters/NewsletterCloudflareLimitsAlert";
import { NewsletterContentChromeProvider } from "@/studio/pages/newsletters/newsletter-content-chrome";
import { NewslettersHubProvider } from "@/studio/stores/newsletters-hub";
import { NewsletterDetailProvider } from "@/studio/stores/newsletter-detail";

export function NewsletterDetailRouteLayout({
  newsletterId,
  children,
}: {
  newsletterId: string;
  children: ReactNode;
}) {
  return (
    <NewslettersHubProvider>
      <NewsletterCloudflareLimitsAlertProvider>
        <NewsletterDetailProvider key={newsletterId} newsletterId={newsletterId}>
          <NewsletterContentChromeProvider>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
          </NewsletterContentChromeProvider>
        </NewsletterDetailProvider>
      </NewsletterCloudflareLimitsAlertProvider>
    </NewslettersHubProvider>
  );
}
