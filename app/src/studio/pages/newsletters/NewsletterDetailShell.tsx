"use client";

import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  BarChart3,
  Loader2,
  Mail,
  Send,
  Settings,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { Button } from "@/components/ui/button";
import { dashboardScrollBodyClassName } from "@/console/lib/page-layout";
import { NewsletterStatusBadge } from "@/studio/components/newsletters/NewsletterStatusBadge";
import {
  defaultNewsletterDetailTab,
  newsletterDetailNavTabs,
} from "@/studio/lib/newsletters/newsletter-detail-nav";
import {
  newsletterDetailFromPathname,
  newsletterDetailHref,
  useStudioPaths,
  type NewsletterDetailTab,
} from "@/studio/lib/paths";
import { NewsletterDetailShellSkeleton } from "@/studio/components/newsletters/NewsletterLoadingSkeletons";
import type { NewsletterStatus } from "@/studio/api";
import { useNewsletterDetail } from "@/studio/stores/newsletter-detail";
import { useNewsletterContentChrome } from "@/studio/pages/newsletters/newsletter-content-chrome";
import { useDesktopChrome } from "@/lib/desktop/shell";
import { newsletterDisplaySubject } from "@/studio/lib/newsletters/newsletter-display-subject";
import { cn } from "@/lib/utils";

const NAV: { id: NewsletterDetailTab; label: string; icon: LucideIcon }[] = [
  { id: "content", label: "Content", icon: Mail },
  { id: "publish", label: "Publish", icon: Send },
  { id: "recipients", label: "Subscribers", icon: Users },
  { id: "stats", label: "Stats", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
];

export function NewsletterDetailShell({
  section,
  fill,
  children,
}: {
  section: NewsletterDetailTab;
  fill?: boolean;
  children: ReactNode;
}) {
  const { newsletters } = useStudioPaths();
  const { noDragClassName, isDesktop } = useDesktopChrome();
  const { newsletterId, newsletter, draftSubject, notFound, refreshing } = useNewsletterDetail();
  const { settingsSheetOpen, setSettingsSheetOpen } = useNewsletterContentChrome();
  const showContentSave = section === "content" && newsletter?.status === "draft";

  const title = notFound
    ? "Newsletter not found"
    : newsletterDisplaySubject(draftSubject || newsletter?.subject);

  const navOrder = newsletterDetailNavTabs(newsletter?.status);
  const navById = new Map(NAV.map((item) => [item.id, item]));
  const navItems = navOrder
    .map((id) => navById.get(id))
    .filter((item): item is (typeof NAV)[number] => item != null);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <DesktopTitleBar
        className="gap-2 px-4 py-3"
        end={
          showContentSave ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label="Customize"
              aria-expanded={settingsSheetOpen}
              aria-pressed={settingsSheetOpen}
              onClick={() => setSettingsSheetOpen(!settingsSheetOpen)}
            >
              <SlidersHorizontal className="size-4" aria-hidden />
              Customize
            </Button>
          ) : null
        }
      >
        <div
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 sm:gap-3",
            noDragClassName,
          )}
          {...(isDesktop ? { "data-tauri-drag-region": "false" } : {})}
        >
          <Button
            variant="ghost"
            size="icon-sm"
            className="-ml-2 shrink-0"
            nativeButton={false}
            aria-label="Back"
            render={<Link href={newsletters} />}
          >
            <ArrowLeft className="size-4" aria-hidden />
          </Button>
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden sm:gap-3">
            <h1 className="min-w-0 shrink truncate text-sm font-semibold">{title}</h1>
            <nav className="flex shrink-0 gap-0.5 overflow-x-auto" aria-label="Broadcast">
              {navItems.map((item) => {
                const href = newsletterDetailHref(
                  newsletterId,
                  item.id,
                  newsletter?.status,
                );
                const Icon = item.icon;
                const active = item.id === section;
                return (
                  <Link
                    key={item.id}
                    href={href}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                    )}
                  >
                    <Icon className="size-3.5" aria-hidden />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            {refreshing ? (
              <Loader2
                className="size-4 shrink-0 animate-spin text-muted-foreground"
                aria-label="Refreshing newsletter"
              />
            ) : null}
            {newsletter ? (
              <NewsletterStatusBadge
                status={newsletter.status}
                listStatus={newsletter.listStatus}
                className="shrink-0"
              />
            ) : null}
          </div>
        </div>
      </DesktopTitleBar>

      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col",
          fill ? "overflow-hidden" : "overflow-auto",
        )}
      >
        <div
          className={cn(
            fill ? "flex min-h-0 flex-1 flex-col" : dashboardScrollBodyClassName("space-y-4"),
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function resolveNewsletterDetailSection(
  pathname: string,
  status: NewsletterStatus | undefined,
): NewsletterDetailTab {
  const fromPath = newsletterDetailFromPathname(pathname);
  if (!fromPath) return "content";
  if (fromPath.tab === null) return defaultNewsletterDetailTab(status);
  return fromPath.tab;
}

export function NewsletterDetailSectionLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { newsletter, loading, notFound } = useNewsletterDetail();
  const section = resolveNewsletterDetailSection(pathname, newsletter?.status);

  if (loading && !newsletter) {
    return <NewsletterDetailShellSkeleton />;
  }
  if (notFound || !newsletter) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <DesktopTitleBar className="px-4 py-3">
          <h1 className="truncate text-sm font-semibold">Newsletter not found</h1>
        </DesktopTitleBar>
        <div className={dashboardScrollBodyClassName("text-sm text-muted-foreground")}>
          This newsletter does not exist or was removed.
        </div>
      </div>
    );
  }

  return (
    <NewsletterDetailShell section={section} fill={section === "content"}>
      {children}
    </NewsletterDetailShell>
  );
}
