"use client";

import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  BarChart3,
  Mail,
  Send,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { Button } from "@/components/ui/button";
import { dashboardScrollBodyClassName } from "@/console/lib/page-layout";
import { NewsletterStatusBadge } from "@/scale/components/newsletters/NewsletterStatusBadge";
import { newsletterDetailNavTabs } from "@/scale/lib/newsletters/newsletter-detail-nav";
import { newsletterDetailHref, useScalePaths, type NewsletterDetailTab } from "@/scale/lib/paths";
import { useNewsletterDetail } from "@/scale/pages/newsletters/NewsletterDetailContext";
import { useDesktopChrome } from "@/lib/desktop/shell";
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
  const { newsletters } = useScalePaths();
  const { noDragClassName, isDesktop } = useDesktopChrome();
  const { newsletterId, newsletter, notFound } = useNewsletterDetail();

  const title =
    newsletter?.name?.trim() ||
    newsletter?.subject?.trim() ||
    (notFound ? "Newsletter not found" : "Untitled newsletter");

  const navOrder = newsletterDetailNavTabs(newsletter?.status);
  const navById = new Map(NAV.map((item) => [item.id, item]));
  const navItems = navOrder
    .map((id) => navById.get(id))
    .filter((item): item is (typeof NAV)[number] => item != null);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <DesktopTitleBar className="gap-2 px-4 py-3">
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
