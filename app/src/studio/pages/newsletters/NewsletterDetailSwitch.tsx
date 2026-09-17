"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { Button } from "@/components/ui/button";
import { dashboardScrollBodyClassName } from "@/console/lib/page-layout";
import {
  defaultNewsletterDetailTab,
  normalizeNewsletterDetailTab,
} from "@/studio/lib/newsletters/newsletter-detail-nav";
import { newsletterDetailHref, useStudioPaths, type NewsletterDetailTab } from "@/studio/lib/paths";
import { NewsletterSubscribersView } from "@/studio/pages/newsletters/NewsletterSubscribersView";
import { NewsletterContentView } from "@/studio/pages/newsletters/NewsletterContentView";
import { NewsletterDetailShell } from "@/studio/pages/newsletters/NewsletterDetailShell";
import { NewsletterPublishView } from "@/studio/pages/newsletters/NewsletterPublishView";
import { NewsletterSettingsView } from "@/studio/pages/newsletters/NewsletterSettingsView";
import { NewsletterStatsView } from "@/studio/pages/newsletters/NewsletterStatsView";
import { NewsletterDetailShellSkeleton } from "@/studio/components/newsletters/NewsletterLoadingSkeletons";
import { useNewsletterDetail } from "@/studio/stores/newsletter-detail";

function NewsletterNotFound() {
  const { newsletters } = useStudioPaths();
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <DesktopTitleBar className="px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            className="-ml-2"
            nativeButton={false}
            aria-label="Back"
            render={<Link href={newsletters} />}
          >
            <ArrowLeft className="size-4" aria-hidden />
          </Button>
          <h1 className="truncate text-sm font-semibold">Newsletter not found</h1>
        </div>
      </DesktopTitleBar>
      <div className={dashboardScrollBodyClassName("text-sm text-muted-foreground")}>
        This newsletter does not exist or was removed.
      </div>
    </div>
  );
}

export function NewsletterDetailSwitch({ tab }: { tab: NewsletterDetailTab | null }) {
  const router = useRouter();
  const { newsletterId, newsletter, loading, notFound } = useNewsletterDetail();

  const resolvedTab = newsletter
    ? normalizeNewsletterDetailTab(
        tab ?? defaultNewsletterDetailTab(newsletter.status),
        newsletter.status,
      )
    : tab ?? "content";

  useEffect(() => {
    if (!newsletter || tab === null) return;
    if (resolvedTab !== tab) {
      router.replace(newsletterDetailHref(newsletterId, resolvedTab, newsletter.status));
    }
  }, [newsletter, newsletterId, resolvedTab, router, tab]);

  if (loading && !newsletter) {
    return <NewsletterDetailShellSkeleton />;
  }
  if (notFound || !newsletter) return <NewsletterNotFound />;

  return (
    <NewsletterDetailShell section={resolvedTab} fill={resolvedTab === "content"}>
      {resolvedTab === "content" ? <NewsletterContentView /> : null}
      {resolvedTab === "publish" ? <NewsletterPublishView /> : null}
      {resolvedTab === "recipients" ? <NewsletterSubscribersView /> : null}
      {resolvedTab === "stats" ? <NewsletterStatsView /> : null}
      {resolvedTab === "settings" ? <NewsletterSettingsView /> : null}
    </NewsletterDetailShell>
  );
}
