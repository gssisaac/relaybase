"use client";

import type { LucideIcon } from "lucide-react";
import { BarChart3, Eye, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { dashboardScrollBodyClassName } from "@/console/lib/page-layout";
import { TriggerStatusBadge } from "@/scale/components/triggers/TriggerStatusBadge";
import { triggerDetailNavTabs } from "@/scale/lib/triggers/trigger-detail-nav";
import {
  triggerDetailHref,
  triggerTabFromPathname,
  type TriggerDetailTab,
} from "@/scale/lib/paths";
import { TriggerDetailSidebar } from "@/scale/pages/triggers/TriggerDetailSidebar";
import { useTriggerDetail } from "@/scale/pages/triggers/TriggerDetailContext";
import { useDesktopChrome } from "@/lib/desktop/shell";
import { cn } from "@/lib/utils";

const NAV: { id: TriggerDetailTab; label: string; icon: LucideIcon }[] = [
  { id: "preview", label: "Preview", icon: Eye },
  { id: "stats", label: "Stats", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
];

export function TriggerDetailShell({
  section,
  fill,
  children,
}: {
  section: TriggerDetailTab;
  fill?: boolean;
  children: ReactNode;
}) {
  const { noDragClassName, isDesktop } = useDesktopChrome();
  const { triggerId, trigger } = useTriggerDetail();

  const navOrder = triggerDetailNavTabs(trigger?.status ?? "draft");
  const navById = new Map(NAV.map((item) => [item.id, item]));
  const navItems = navOrder
    .map((id) => navById.get(id))
    .filter((item): item is (typeof NAV)[number] => item != null);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
      <TriggerDetailSidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <DesktopTitleBar className="gap-2 px-4 py-3">
        <div
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 sm:gap-3",
            noDragClassName,
          )}
          {...(isDesktop ? { "data-tauri-drag-region": "false" } : {})}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden sm:gap-3">
            <nav className="flex shrink-0 gap-0.5 overflow-x-auto" aria-label="Automation">
              {navItems.map((item) => {
                const href = triggerDetailHref(triggerId, item.id);
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
            {trigger ? (
              <TriggerStatusBadge
                status={trigger.status}
                listStatus={trigger.listStatus}
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
            fill ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden" : dashboardScrollBodyClassName(),
          )}
        >
          {children}
        </div>
      </div>
      </div>
    </div>
  );
}

export function TriggerDetailSectionLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const section = triggerTabFromPathname(pathname);
  return (
    <TriggerDetailShell section={section} fill={section === "preview"}>
      {children}
    </TriggerDetailShell>
  );
}
