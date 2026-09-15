"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowLeft, BarChart3, Mail, Settings, Zap } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { Button } from "@/components/ui/button";
import { dashboardScrollBodyClassName } from "@/console/lib/page-layout";
import { AutomationStatusBadge } from "@/crm/components/AutomationStatusBadge";
import { automationDetailNavTabs } from "@/crm/lib/automation-detail-nav";
import { automationDetailHref, useCrmPaths, type AutomationDetailTab } from "@/crm/lib/paths";
import { useAutomationDetail } from "@/crm/pages/automations/AutomationDetailContext";
import { useDesktopChrome } from "@/lib/desktop/shell";
import { cn } from "@/lib/utils";

const NAV: { id: AutomationDetailTab; label: string; icon: LucideIcon }[] = [
  { id: "content", label: "Content", icon: Mail },
  { id: "trigger", label: "Trigger", icon: Zap },
  { id: "stats", label: "Stats", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
];

export function AutomationDetailShell({
  section,
  fill,
  children,
}: {
  section: AutomationDetailTab;
  fill?: boolean;
  children: ReactNode;
}) {
  const { automations } = useCrmPaths();
  const { noDragClassName, isDesktop } = useDesktopChrome();
  const { automationId, automation, notFound } = useAutomationDetail();

  const title =
    automation?.name?.trim() ||
    automation?.subject?.trim() ||
    (notFound ? "Automation not found" : "Untitled automation");

  const navOrder = automationDetailNavTabs(automation?.status ?? "draft");
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
            size="sm"
            className="-ml-2 shrink-0"
            nativeButton={false}
            render={<Link href={automations} />}
          >
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">Automations</span>
          </Button>
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden sm:gap-3">
            <h1 className="min-w-0 shrink truncate text-sm font-semibold">{title}</h1>
            <nav className="flex shrink-0 gap-0.5 overflow-x-auto" aria-label="Automation">
              {navItems.map((item) => {
                const href = automationDetailHref(
                  automationId,
                  item.id,
                  automation?.status,
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
            {automation ? (
              <AutomationStatusBadge
                status={automation.status}
                listStatus={automation.listStatus}
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
  );
}
