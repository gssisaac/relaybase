"use client";

import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowLeft,
  History,
  LayoutDashboard,
  Send,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAudienceGroupDetail } from "@/dashboard/components/AudienceGroupDetailContext";
import { useDashboardPaths } from "@/dashboard/paths";
import { useDesktopChrome } from "@/lib/desktop/use-desktop-chrome";
import { cn } from "@/lib/utils";

export type AudienceGroupSection =
  | "overview"
  | "contacts"
  | "send"
  | "progress"
  | "history"
  | "settings";

const NAV: { id: AudienceGroupSection; label: string; icon: LucideIcon }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "contacts", label: "Audience", icon: Users },
  { id: "send", label: "Send", icon: Send },
  { id: "progress", label: "Progress", icon: Activity },
  { id: "history", label: "History", icon: History },
  { id: "settings", label: "Settings", icon: Settings },
];

export function AudienceGroupDetailShell({
  section,
  children,
}: {
  section: AudienceGroupSection;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { audience } = useDashboardPaths();
  const { noDragClassName, isDesktop } = useDesktopChrome();
  const { groupId, detail, notFound } = useAudienceGroupDetail();

  const base = `/audience/${encodeURIComponent(groupId)}`;
  const title = detail?.group.name ?? (notFound ? "Group not found" : "…");

  const hrefFor = (id: AudienceGroupSection) =>
    id === "overview" ? base : `${base}/${id}`;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <DesktopTitleBar className="flex-col items-stretch gap-0">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <div
            className={cn(noDragClassName)}
            {...(isDesktop ? { "data-tauri-drag-region": "false" } : {})}
          >
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2"
              nativeButton={false}
              render={<Link href={audience} />}
            >
              <ArrowLeft className="size-4" />
              Audience
            </Button>
          </div>
          <div className="flex min-w-0 items-baseline gap-2">
            <h1 className="truncate text-sm font-semibold">{title}</h1>
            {detail?.group.domain ? (
              <span className="truncate font-mono text-xs text-muted-foreground">
                {detail.group.domain}
              </span>
            ) : null}
            {detail?.group.dataSource ? (
              <Badge variant="outline" className="text-[10px]">
                {detail.group.cronEnabled ? "Synced · scheduled" : "Synced"}
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px]">
                Manual
              </Badge>
            )}
          </div>
        </div>
        <nav
          className={cn(
            "flex gap-1 overflow-x-auto px-4 pb-2",
            noDragClassName,
          )}
          aria-label="Audience group"
          {...(isDesktop ? { "data-tauri-drag-region": "false" } : {})}
        >
          {NAV.map((item) => {
            const href = hrefFor(item.id);
            const Icon = item.icon;
            const active =
              item.id === section ||
              pathname === href ||
              (item.id !== "overview" && pathname.startsWith(`${href}/`));
            return (
              <Link
                key={item.id}
                href={href}
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

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
        <div className="mx-auto w-full max-w-[1200px] space-y-4 p-4">
          {children}
        </div>
      </div>
    </div>
  );
}
