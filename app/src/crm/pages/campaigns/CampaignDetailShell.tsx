"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Mail, Settings, Users } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { dashboardScrollBodyClassName } from "@/console/lib/page-layout";
import {
  campaignDetailHref,
  useCrmPaths,
  type CampaignDetailTab,
} from "@/crm/lib/paths";
import { useCampaignDetail } from "@/crm/pages/campaigns/CampaignDetailContext";
import { useDesktopChrome } from "@/lib/desktop/shell";
import { cn } from "@/lib/utils";

const NAV: { id: CampaignDetailTab; label: string; icon: LucideIcon }[] = [
  { id: "subscribers", label: "Subscribers", icon: Users },
  { id: "broadcasts", label: "Broadcasts", icon: Mail },
  { id: "settings", label: "Settings", icon: Settings },
];

export function CampaignDetailShell({
  section,
  children,
}: {
  section: CampaignDetailTab;
  children: ReactNode;
}) {
  const { campaigns } = useCrmPaths();
  const { noDragClassName, isDesktop } = useDesktopChrome();
  const { campaignId, campaign, notFound } = useCampaignDetail();

  const title = campaign?.name?.trim() || (notFound ? "Campaign not found" : "Untitled campaign");

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
            size="sm"
            className="-ml-2 shrink-0"
            nativeButton={false}
            render={<Link href={campaigns} />}
          >
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">Campaigns</span>
          </Button>
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden sm:gap-3">
            <h1 className="min-w-0 shrink truncate text-sm font-semibold">{title}</h1>
            <nav
              className="flex shrink-0 gap-0.5 overflow-x-auto"
              aria-label="Campaign"
            >
            {NAV.map((item) => {
              const href = campaignDetailHref(campaignId, item.id);
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
            {campaign?.status ? (
              <Badge
                variant={campaign.status === "archived" ? "secondary" : "outline"}
                className="shrink-0 text-[10px] capitalize"
              >
                {campaign.status}
              </Badge>
            ) : null}
          </div>
        </div>
      </DesktopTitleBar>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
        <div className={dashboardScrollBodyClassName("space-y-4")}>{children}</div>
      </div>
    </div>
  );
}
