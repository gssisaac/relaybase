"use client";

import { History } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useAudienceGroupDetail } from "@/crm/pages/audience/AudienceGroupDetailContext";
import type { AudienceSyncRun } from "@/email/components/mailbox/types";

function syncStatusVariant(
  status: AudienceSyncRun["status"],
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "success") return "default";
  if (status === "error") return "destructive";
  return "secondary";
}

function syncSummary(run: AudienceSyncRun): string | undefined {
  if (run.status === "running") return run.phase !== "idle" ? run.phase : "Running…";
  if (run.totalCount != null) {
    const skipped =
      run.skippedCount != null && run.skippedCount > 0
        ? ` · ${run.skippedCount} skipped`
        : "";
    return `${run.totalCount} contacts${skipped}`;
  }
  if (run.error) return run.error;
  return undefined;
}

export function AudienceGroupHistoryView() {
  const { detail } = useAudienceGroupDetail();
  const history = detail?.group.syncHistory ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Sync history</h2>
        <p className="text-xs text-muted-foreground">
          Manual or scheduled data-source syncs for this group.
        </p>
      </div>

      {history.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <History className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">No sync history yet</p>
            <p className="text-xs text-muted-foreground">
              Manual or scheduled data-source syncs for this group will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y divide-border p-0">
            {history.map((run) => {
              const summary = syncSummary(run);
              return (
                <div
                  key={run.id}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {new Date(run.startedAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {run.trigger === "cron" ? "Scheduled" : "Manual"}
                      {summary ? ` · ${summary}` : ""}
                    </p>
                  </div>
                  <Badge
                    variant={syncStatusVariant(run.status)}
                    className="shrink-0 text-[10px] capitalize"
                  >
                    {run.status}
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
