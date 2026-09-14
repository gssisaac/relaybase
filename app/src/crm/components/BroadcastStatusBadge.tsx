"use client";

import { Clock, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { BroadcastListStatus, BroadcastStatus } from "@/lib/crm/api";
import { cn } from "@/lib/utils";

interface BroadcastStatusBadgeProps {
  status: BroadcastStatus | string;
  listStatus?: BroadcastListStatus | string | null;
  className?: string;
}

export function BroadcastStatusBadge({
  status,
  listStatus,
  className,
}: BroadcastStatusBadgeProps) {
  if (listStatus === "archived") {
    return (
      <Badge
        variant="secondary"
        className={cn("text-[10px] font-normal capitalize", className)}
      >
        Archived
      </Badge>
    );
  }

  switch (status) {
    case "sent":
      return (
        <Badge
          variant="outline"
          className={cn(
            "border-emerald-600/30 bg-emerald-500/10 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 capitalize",
            className,
          )}
        >
          Sent
        </Badge>
      );
    case "sending":
      return (
        <Badge
          variant="outline"
          className={cn(
            "inline-flex items-center gap-1 border-sky-600/30 bg-sky-500/10 text-[10px] font-medium text-sky-700 dark:text-sky-400 capitalize",
            className,
          )}
        >
          <Loader2 className="size-2.5 animate-spin" />
          Sending
        </Badge>
      );
    case "scheduled":
      return (
        <Badge
          variant="outline"
          className={cn(
            "inline-flex items-center gap-1 border-amber-600/30 bg-amber-500/10 text-[10px] font-medium text-amber-700 dark:text-amber-400 capitalize",
            className,
          )}
        >
          <Clock className="size-2.5" />
          Scheduled
        </Badge>
      );
    case "failed":
      return (
        <Badge
          variant="outline"
          className={cn(
            "border-destructive/40 bg-destructive/10 text-[10px] font-medium text-destructive capitalize",
            className,
          )}
        >
          Failed
        </Badge>
      );
    case "draft":
    default:
      return (
        <Badge
          variant="outline"
          className={cn(
            "border-border bg-muted/60 text-[10px] font-normal text-muted-foreground capitalize",
            className,
          )}
        >
          Draft
        </Badge>
      );
  }
}
