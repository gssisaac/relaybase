"use client";

import type { LucideIcon } from "lucide-react";
import {
  Cloud,
  Database,
  HardDrive,
  Loader2,
  RefreshCw,
  Server,
  Shield,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { Button } from "@/components/ui/button";
import { settingsTabHref, type SettingsTab } from "@/console/lib/paths";
import { useSettingsConnection } from "@/console/pages/settings/SettingsConnectionContext";
import { useDesktopChrome } from "@/lib/desktop/use-desktop-chrome";
import { cn } from "@/lib/utils";

const TAB_COPY: Record<
  SettingsTab,
  { label: string; icon: LucideIcon; description: string }
> = {
  cloudflare: {
    label: "Cloudflare",
    icon: Cloud,
    description: "API token for zone import and Email Routing assist.",
  },
  worker: {
    label: "Worker",
    icon: Server,
    description: "Routing Worker URL and admin token verification.",
  },
  "admin-token": {
    label: "Admin token",
    icon: Shield,
    description: "Recover a lost ADMIN_TOKEN without Wrangler.",
  },
  "inbound-r2": {
    label: "Inbound R2",
    icon: HardDrive,
    description: "Inbound bucket binding and usage from your Worker.",
  },
  d1: {
    label: "D1",
    icon: Database,
    description: "Ops log and inbox search database bindings.",
  },
};

const NAV: SettingsTab[] = [
  "cloudflare",
  "worker",
  "inbound-r2",
  "d1",
  "admin-token",
];

export function SettingsShell({
  tab,
  children,
}: {
  tab: SettingsTab;
  children: ReactNode;
}) {
  const { noDragClassName, isDesktop } = useDesktopChrome();
  const { statusBusy, workerBusy, handleRefreshStatus } = useSettingsConnection();
  const copy = TAB_COPY[tab];
  const showRefresh =
    tab === "worker" || tab === "inbound-r2" || tab === "d1";

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <DesktopTitleBar className="flex-col items-stretch gap-0 px-0">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold tracking-tight">
              Settings
            </h1>
            <p className="text-sm text-muted-foreground">{copy.description}</p>
          </div>
          {showRefresh ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={statusBusy || workerBusy}
              aria-label="Refresh status"
              onClick={() => void handleRefreshStatus()}
            >
              {statusBusy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
            </Button>
          ) : null}
        </div>
        <nav
          className={cn(
            "flex gap-1 overflow-x-auto border-t border-border px-4 pb-2 pt-2",
            noDragClassName,
          )}
          aria-label="Settings"
          {...(isDesktop ? { "data-tauri-drag-region": "false" } : {})}
        >
          {NAV.map((id) => {
            const item = TAB_COPY[id];
            const Icon = item.icon;
            const active = id === tab;
            return (
              <Link
                key={id}
                href={settingsTabHref(id)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
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
      </DesktopTitleBar>

      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
