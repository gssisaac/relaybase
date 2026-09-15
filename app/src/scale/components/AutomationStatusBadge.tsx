"use client";

import { Badge } from "@/components/ui/badge";
import type { AutomationListStatus, AutomationStatus } from "@/lib/scale/api";
import { cn } from "@/lib/utils";

export function AutomationStatusBadge({
  status,
  listStatus,
  className,
}: {
  status: AutomationStatus;
  listStatus?: AutomationListStatus | null;
  className?: string;
}) {
  if (listStatus === "archived") {
    return (
      <Badge variant="secondary" className={cn("text-[10px] font-normal", className)}>
        Archived
      </Badge>
    );
  }

  switch (status) {
    case "active":
      return (
        <Badge
          variant="outline"
          className={cn(
            "border-emerald-600/30 bg-emerald-500/10 text-[10px] font-medium text-emerald-700 dark:text-emerald-400",
            className,
          )}
        >
          Active
        </Badge>
      );
    case "paused":
      return (
        <Badge
          variant="outline"
          className={cn(
            "border-amber-600/30 bg-amber-500/10 text-[10px] font-medium text-amber-700 dark:text-amber-400",
            className,
          )}
        >
          Paused
        </Badge>
      );
    case "draft":
    default:
      return (
        <Badge
          variant="outline"
          className={cn(
            "border-border bg-muted/60 text-[10px] font-normal text-muted-foreground",
            className,
          )}
        >
          Draft
        </Badge>
      );
  }
}
