"use client";

import { Activity, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useAudienceGroupDetail } from "@/dashboard/components/AudienceGroupDetailContext";
import { useEmailPaths } from "@/email/paths";
import { EmailAlerts } from "@/email/components/EmailShared";
import type {
  AudienceGroupProgress,
  AudienceSyncRun,
} from "@/email/components/types";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
            {(run.successCount ?? (run.status === "success" ? processed : 0)).toLocaleString()}
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
        const res = await fetch(
          `${apiBase}/audience-groups/${encodeURIComponent(groupId)}/progress`,
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load progress");
        setData(json as AudienceGroupProgress);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load progress");
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

  const running = data?.progress?.status === "running";

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      void load({ quiet: true });
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [load, running]);

  const current = data?.progress ?? null;
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
            Live status for manual refresh and scheduled cron pulls.
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

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-1">
            <CardDescription className="text-xs">Schedule</CardDescription>
            <CardTitle className="text-base font-semibold">
              {data?.cronEnabled && data.cronIntervalMinutes
                ? `Every ${data.cronIntervalMinutes}m`
                : "Off"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardDescription className="text-xs">Next due</CardDescription>
            <CardTitle className="text-base font-semibold">
              {data?.cronEnabled ? formatWhen(data.nextDueAt ?? undefined) : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardDescription className="text-xs">Last sync</CardDescription>
            <CardTitle className="text-base font-semibold">
              {formatWhen(data?.lastSyncAt)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Activity className="size-4" />
            Current run
          </CardTitle>
          <CardDescription>
            {current
              ? `Started ${formatWhen(current.startedAt)}`
              : "No sync has run yet for this group."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {current ? (
            <RunStats run={current} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Trigger a refresh from Overview, or wait for the next scheduled
              cron pull.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recent runs</CardTitle>
          <CardDescription>
            Latest sync attempts (manual and cron).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {history.length > 0 ? (
            <ul className="divide-y divide-border">
              {history.map((run) => {
                const elapsed =
                  run.finishedAt != null && run.finishedAt !== ""
                    ? new Date(run.finishedAt).getTime() -
                      new Date(run.startedAt).getTime()
                    : null;
                return (
                  <li
                    key={run.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant={statusVariant(run.status)}
                          className="text-[10px] capitalize"
                        >
                          {run.status}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="text-[10px] capitalize"
                        >
                          {run.trigger}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatWhen(run.startedAt)}
                        </span>
                      </div>
                      {run.error ? (
                        <p className="truncate text-xs text-destructive">
                          {run.error}
                        </p>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                      <p>
                        {(run.successCount ?? run.processedCount ?? 0).toLocaleString()}
                        {" ok"}
                        {(run.failedCount ?? run.skippedCount ?? 0) > 0
                          ? ` · ${(run.failedCount ?? run.skippedCount ?? 0).toLocaleString()} failed`
                          : ""}
                      </p>
                      <p>{formatDuration(elapsed)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No runs yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
