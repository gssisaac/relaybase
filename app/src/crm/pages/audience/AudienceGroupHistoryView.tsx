"use client";

import { useAudienceGroupDetail } from "@/crm/pages/audience/AudienceGroupDetailContext";
import {
  EmailListContainer,
  EmailTableHeader,
  EmailTableRow,
  EmptyListState,
} from "@/email/components/mailbox/EmailListShell";
import type { AudienceSyncRun } from "@/email/components/mailbox/types";

import { Badge } from "@/components/ui/badge";

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
  const { detail, loading } = useAudienceGroupDetail();
  const history = detail?.group.syncHistory ?? [];

  return (
    <div className="space-y-4">
      <EmailListContainer>
        {history.length > 0 ? (
          <>
            <EmailTableHeader>
              <span>Sync</span>
              <span className="hidden sm:block">Trigger</span>
              <span />
              <span className="text-right">Status</span>
            </EmailTableHeader>
            <div>
              {history.map((run) => (
                <EmailTableRow
                  key={run.id}
                  primary={new Date(run.startedAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  subject={run.trigger === "cron" ? "Scheduled" : "Manual"}
                  preview={syncSummary(run)}
                  date={
                    run.finishedAt
                      ? new Date(run.finishedAt).toLocaleDateString()
                      : "—"
                  }
                  status={
                    <Badge
                      variant={syncStatusVariant(run.status)}
                      className="text-[10px] capitalize"
                    >
                      {run.status}
                    </Badge>
                  }
                />
              ))}
            </div>
          </>
        ) : !loading ? (
          <EmptyListState
            title="No sync history yet"
            description="Manual or scheduled data-source syncs for this group will appear here."
          />
        ) : (
          <div className="min-h-[200px]" />
        )}
      </EmailListContainer>
    </div>
  );
}
