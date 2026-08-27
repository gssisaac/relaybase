"use client";

import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowLeft,
  FileText,
  LayoutDashboard,
  Users,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useBroadcastDetail } from "@/console/pages/broadcasts/BroadcastDetailContext";
import {
  broadcastDetailHref,
  useDashboardPaths,
  type BroadcastDetailTab,
} from "@/console/lib/paths";
import { useDesktopChrome } from "@/lib/desktop/shell";
import { cn } from "@/lib/utils";

export type BroadcastSection =
  | "overview"
  | "audience"
  | "content"
  | "progress";

const NAV: { id: BroadcastSection; label: string; icon: LucideIcon }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "audience", label: "Audience", icon: Users },
  { id: "content", label: "Content", icon: FileText },
  { id: "progress", label: "Progress", icon: Activity },
];

function statusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "sent") return "default";
  if (status === "failed") return "destructive";
  if (status === "sending") return "outline";
  return "secondary";
}

export function BroadcastDetailShell({
  section,
  children,
}: {
  section: BroadcastSection;
  children: ReactNode;
}) {
  const { broadcasts } = useDashboardPaths();
  const { noDragClassName, isDesktop } = useDesktopChrome();
  const { broadcastId, detail, notFound } = useBroadcastDetail();

  const title =
    detail?.broadcast.subject?.trim() ||
    (notFound ? "Broadcast not found" : "Untitled draft");

  const hrefFor = (id: BroadcastSection) =>
    broadcastDetailHref(broadcastId, id as BroadcastDetailTab);

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
              render={<Link href={broadcasts} />}
            >
              <ArrowLeft className="size-4" />
              Broadcasts
            </Button>
          </div>
          <div className="flex min-w-0 items-baseline gap-2">
            <h1 className="truncate text-sm font-semibold">{title}</h1>
            {detail?.broadcast.status ? (
              <Badge
                variant={statusVariant(detail.broadcast.status)}
                className="text-[10px] capitalize"
              >
                {detail.broadcast.status}
              </Badge>
            ) : null}
          </div>
        </div>
        <nav
          className={cn(
            "flex gap-1 overflow-x-auto px-4 pb-2",
            noDragClassName,
          )}
          aria-label="Broadcast"
          {...(isDesktop ? { "data-tauri-drag-region": "false" } : {})}
        >
          {NAV.map((item) => {
            const href = hrefFor(item.id);
            const Icon = item.icon;
            const active = item.id === section;
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
