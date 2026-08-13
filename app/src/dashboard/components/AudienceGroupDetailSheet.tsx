"use client";

import type { LucideIcon } from "lucide-react";
import { History, Settings, Users } from "lucide-react";
import { type ReactNode } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import type { AudienceDetailTab } from "@/dashboard/paths";
import { AudienceGroupContactsView } from "@/dashboard/components/AudienceGroupContactsView";
import { AudienceGroupHistoryView } from "@/dashboard/components/AudienceGroupHistoryView";
import { AudienceGroupSettingsView } from "@/dashboard/components/AudienceGroupSettingsView";
import {
  AudienceGroupDetailProvider,
  useAudienceGroupDetail,
} from "@/dashboard/components/AudienceGroupDetailContext";
import { cn } from "@/lib/utils";

const NAV: { id: AudienceDetailTab; label: string; icon: LucideIcon }[] = [
  { id: "contacts", label: "Audience list", icon: Users },
  { id: "history", label: "Send history", icon: History },
  { id: "settings", label: "Settings", icon: Settings },
];

function AudienceGroupDetailBody({ tab }: { tab: AudienceDetailTab }): ReactNode {
  if (tab === "history") return <AudienceGroupHistoryView />;
  if (tab === "settings") return <AudienceGroupSettingsView />;
  return <AudienceGroupContactsView />;
}

function AudienceGroupDetailSheetChrome({
  tab,
  onTabChange,
}: {
  tab: AudienceDetailTab;
  onTabChange: (tab: AudienceDetailTab) => void;
}) {
  const { detail, notFound } = useAudienceGroupDetail();

  const title = detail?.group.name ?? (notFound ? "Group not found" : "…");
  const domain = detail?.group.domain;
  const synced = Boolean(detail?.group.dataSource);

  return (
    <>
      <SheetHeader className="shrink-0 border-b border-border/60 pr-12">
        <SheetTitle className="truncate">{title}</SheetTitle>
        <SheetDescription className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {domain ? (
            <span className="truncate font-mono text-xs">{domain}</span>
          ) : null}
          {synced ? (
            <Badge variant="outline" className="text-[10px]">
              {detail?.group.cronEnabled ? "Synced · scheduled" : "Synced"}
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px]">
              Manual
            </Badge>
          )}
        </SheetDescription>
      </SheetHeader>

      <nav
        className="flex shrink-0 gap-1 overflow-x-auto border-b border-border/60 px-4 py-2"
        aria-label="Audience group"
      >
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = item.id === tab;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" aria-hidden />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <AudienceGroupDetailBody tab={tab} />
      </div>
    </>
  );
}

type AudienceGroupDetailSheetProps = {
  groupId: string;
  tab: AudienceDetailTab;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTabChange: (tab: AudienceDetailTab) => void;
};

export function AudienceGroupDetailSheet({
  groupId,
  tab,
  open,
  onOpenChange,
  onTabChange,
}: AudienceGroupDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="h-full w-full max-w-[600px] gap-0 overflow-hidden p-0 sm:max-w-[600px]"
      >
        <AudienceGroupDetailProvider groupId={groupId}>
          <AudienceGroupDetailSheetChrome tab={tab} onTabChange={onTabChange} />
        </AudienceGroupDetailProvider>
      </SheetContent>
    </Sheet>
  );
}
