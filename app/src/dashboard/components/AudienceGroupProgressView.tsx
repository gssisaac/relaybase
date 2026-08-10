"use client";

import { Activity, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAudienceGroupDetail } from "@/dashboard/components/AudienceGroupDetailContext";
import { useEmailPaths } from "@/email/paths";
import { EmailAlerts } from "@/email/components/EmailShared";
import type {
  AudienceGroupProgress,
  AudienceSyncRun,
} from "@/email/components/types";
import {
  desktopAwareFetch,
  friendlyDesktopFetchError,
  readResponseJson,
} from "@/lib/desktop/api-base";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const POLL_MS = 2000;

function formatDuration(ms: number | undefined | null): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 1000) return "<1s";
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min < 60) return sec ? `${min}m ${sec}s` : `${min}m`;
  const hr = Math.floor(min / 60);
  const remMin = min % 60;
  return remMin ? `${hr}h ${remMin}m` : `${hr}h`;
}

function formatWhen(value?: string): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function phaseLabel(phase: string): string {
  switch (phase) {
    case "fetching":
      return "Fetching endpoint";
    case "parsing":
      return "Parsing contacts";
    case "writing":
      return "Writing contacts";
    case "done":
      return "Done";
    default:
      return phase;
  }
}

function statusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "success") return "default";
  if (status === "error") return "destructive";
  if (status === "running") return "outline";
  return "secondary";
}

function ProgressBar({
  value,
  indeterminate,
  className,
}: {
  value: number;
  indeterminate?: boolean;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-muted",
        className,
      )}
    >
      <div
        className={cn(
          "h-full rounded-full bg-primary transition-[width] duration-300",
          indeterminate && "w-1/3 animate-pulse",
        )}
        style={indeterminate ? undefined : { width: `${clamped}%` }}
      />
    </div>
  );
}

function RunStats({ run }: { run: AudienceSyncRun }) {
  const total = run.totalCount ?? 0;
  const processed = run.processedCount ?? 0;
  const pct =
    run.status === "running" && run.phase === "fetching"
      ? 0
      : total > 0
        ? Math.round((processed / total) * 100)
        : run.status === "success"
          ? 100
          : 0;
  const indeterminate = run.status === "running" && run.phase === "fetching";
  const elapsedMs = run.finishedAt
    ? new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()
    : Date.now() - new Date(run.startedAt).getTime();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={statusVariant(run.status)} className="capitalize">
          {run.status}
        </Badge>
        <Badge variant="outline" className="text-[10px] capitalize">
          {run.trigger}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {phaseLabel(run.phase)}
        </span>
      </div>

      <ProgressBar value={pct} indeterminate={indeterminate} />

      <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">Progress</p>
          <p className="tabular-nums font-medium">
            {indeterminate
              ? "Fetching…"
              : `${processed.toLocaleString()} / ${total.toLocaleString()} (${pct}%)`}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Success / failed</p>
          <p className="tabular-nums font-medium">
            {(
              run.successCount ?? (run.status === "success" ? processed : 0)
            ).toLocaleString()}
            {" / "}
            {(run.failedCount ?? run.skippedCount ?? 0).toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Elapsed</p>
          <p className="tabular-nums font-medium">{formatDuration(elapsedMs)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Est. remaining</p>
          <p className="tabular-nums font-medium">
            {run.status === "running"
              ? formatDuration(run.estimatedRemainingMs)
              : "—"}
          </p>
        </div>
      </div>

      {run.error ? (
        <p className="text-xs text-destructive">{run.error}</p>
      ) : null}
    </div>
  );
}

function PastRunsTable({ history }: { history: AudienceSyncRun[] }) {
  if (history.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No past runs yet.</p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Status</TableHead>
          <TableHead>Trigger</TableHead>
          <TableHead>Started</TableHead>
          <TableHead className="text-right">Success</TableHead>
          <TableHead className="text-right">Failed</TableHead>
          <TableHead className="text-right">Duration</TableHead>
          <TableHead>Error</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {history.map((run) => {
          const elapsed =
            run.finishedAt != null && run.finishedAt !== ""
              ? new Date(run.finishedAt).getTime() -
                new Date(run.startedAt).getTime()
              : null;
          const success =
            run.successCount ?? run.processedCount ?? 0;
          const failed = run.failedCount ?? run.skippedCount ?? 0;
          return (
            <TableRow key={run.id}>
              <TableCell>
                <Badge
                  variant={statusVariant(run.status)}
                  className="text-[10px] capitalize"
                >
                  {run.status}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className="text-[10px] capitalize"
                >
                  {run.trigger}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground whitespace-nowrap">
                {formatWhen(run.startedAt)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {success.toLocaleString()}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {failed.toLocaleString()}
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {formatDuration(elapsed)}
              </TableCell>
              <TableCell className="max-w-56 truncate text-destructive">
                {run.error || "—"}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export function AudienceGroupProgressView() {
  const { apiBase } = useEmailPaths();
  const { groupId, detail } = useAudienceGroupDetail();
  const [data, setData] = useState<AudienceGroupProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (opts?: { quiet?: boolean }) => {
      if (!opts?.quiet) setRefreshing(true);
      try {
        const res = await desktopAwareFetch(
          `${apiBase}/audience-groups/${encodeURIComponent(groupId)}/progress`,
        );
        const json = await readResponseJson<
          AudienceGroupProgress & { error?: string }
        >(res);
        if (!res.ok) throw new Error(json.error ?? "Failed to load progress");
        setData(json);
        setError(null);
      } catch (e) {
        setError(friendlyDesktopFetchError(e, "Failed to load progress"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [apiBase, groupId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Only treat a run as "current" while it is actually in flight.
  const current = useMemo((): AudienceSyncRun | null => {
    const progress = data?.progress ?? null;
    if (progress?.status === "running") return progress;
    return null;
  }, [data?.progress]);

  const inProgress = current != null;

  useEffect(() => {
    if (!inProgress) return;
    const id = window.setInterval(() => {
      void load({ quiet: true });
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [load, inProgress]);

  const history = data?.history ?? [];

  if (loading && !data) {
    return <p className="text-sm text-muted-foreground">Loading progress…</p>;
  }

  if (!detail?.group.dataSource) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">No data source</CardTitle>
          <CardDescription>
            Sync progress appears here once this group has an endpoint
            configured in Settings.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Sync progress</h2>
          <p className="text-xs text-muted-foreground">
            {inProgress
              ? "Live status for manual refresh and scheduled cron pulls."
              : "Past sync attempts for this group."}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={refreshing}
        >
          <RefreshCw
            className={refreshing ? "size-4 animate-spin" : "size-4"}
          />
          Refresh
        </Button>
      </div>

      <EmailAlerts
        error={error}
        message={null}
        onDismissError={() => setError(null)}
      />

      {inProgress && current ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Activity className="size-4" />
              Current run
            </CardTitle>
            <CardDescription>
              Started {formatWhen(current.startedAt)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RunStats run={current} />
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-2">
        <div>
          <h3 className="text-sm font-semibold">Past runs</h3>
          <p className="text-xs text-muted-foreground">
            Latest sync attempts (manual and cron).
          </p>
        </div>
        <PastRunsTable history={history} />
      </div>
    </div>
  );
}
