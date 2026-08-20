"use client";

import { Activity, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useBroadcastDetail } from "@/console/pages/broadcasts/BroadcastDetailContext";
import { useBroadcast } from "@/lib/dashboard/BroadcastContext";
import { useEmailPaths } from "@/email/lib/paths";
import { EmailAlerts } from "@/email/components/mailbox/EmailShared";
import type { BroadcastProgress, BroadcastSendRun } from "@/email/components/mailbox/types";
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
    case "preparing":
      return "Preparing recipients";
    case "sending":
      return "Sending messages";
    case "done":
      return "Done";
    default:
      return phase;
  }
}

function statusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "success" || status === "sent") return "default";
  if (status === "error" || status === "failed") return "destructive";
  if (status === "running" || status === "sending") return "outline";
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

function RunStats({ run }: { run: BroadcastSendRun }) {
  const total = run.totalCount ?? 0;
  const processed = run.processedCount ?? 0;
  const pct =
    run.status === "running" && run.phase === "preparing"
      ? 0
      : total > 0
        ? Math.round((processed / total) * 100)
        : run.status === "success"
          ? 100
          : 0;
  const indeterminate = run.status === "running" && run.phase === "preparing";
  const elapsedMs = run.finishedAt
    ? new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()
    : Date.now() - new Date(run.startedAt).getTime();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={statusVariant(run.status)} className="capitalize">
          {run.status}
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
              ? "Preparing…"
              : `${processed.toLocaleString()} / ${total.toLocaleString()} (${pct}%)`}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Success / failed</p>
          <p className="tabular-nums font-medium">
            {(run.successCount ?? 0).toLocaleString()}
            {" / "}
            {(run.failedCount ?? 0).toLocaleString()}
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

function PastRunsTable({ history }: { history: BroadcastSendRun[] }) {
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
              <TableCell className="text-muted-foreground whitespace-nowrap">
                {formatWhen(run.startedAt)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {(run.successCount ?? 0).toLocaleString()}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {(run.failedCount ?? 0).toLocaleString()}
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {formatDuration(elapsed)}
              </TableCell>
              <TableCell className="max-w-[14rem] truncate text-destructive">
                {run.error || "—"}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export function BroadcastProgressView() {
  const { apiBase } = useEmailPaths();
  const { broadcastId, detail } = useBroadcastDetail();
  const store = useBroadcast();
  const job = store.jobFor(broadcastId);

  const [data, setData] = useState<BroadcastProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (opts?: { quiet?: boolean }) => {
      if (!opts?.quiet) setRefreshing(true);
      try {
        const res = await desktopAwareFetch(
          `${apiBase}/broadcasts/${encodeURIComponent(broadcastId)}/progress`,
        );
        const json = await readResponseJson<
          BroadcastProgress & { error?: string }
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
    [apiBase, broadcastId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const status = data?.status ?? detail?.broadcast.status;
  const jobBusy =
    job?.phase === "uploading" || job?.phase === "sending";

  const progressCandidate =
    data?.progress ?? detail?.broadcast.sendProgress ?? null;

  // Only treat a run as "current" while it is actually in flight.
  const current = useMemo((): BroadcastSendRun | null => {
    if (progressCandidate?.status === "running") return progressCandidate;
    return null;
  }, [progressCandidate]);

  const inProgress =
    current != null || status === "sending" || jobBusy;

  // Only poll while a send is actually in flight — not after sent/failed.
  useEffect(() => {
    if (!inProgress) return;
    const id = window.setInterval(() => {
      void load({ quiet: true });
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [load, inProgress]);

  // Once the server reports a terminal status, drop the in-memory job so
  // isActive / panel routing stop treating this broadcast as live.
  useEffect(() => {
    if (!job) return;
    if (status === "sent" || status === "failed") {
      if (job.phase === "uploading" || job.phase === "sending") return;
      store.dismissJob(broadcastId);
    }
  }, [broadcastId, job, status, store]);

  const history = useMemo((): BroadcastSendRun[] => {
    if (data?.history && data.history.length > 0) return data.history;
    return detail?.broadcast.sendHistory ?? [];
  }, [data?.history, detail?.broadcast.sendHistory]);

  const jobError = job?.phase === "failed" ? job.error : null;

  if (loading && !data && !current) {
    return <p className="text-sm text-muted-foreground">Loading progress…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Broadcast progress</h2>
          <p className="text-xs text-muted-foreground">
            {inProgress
              ? "Live status while messages are delivered to the audience."
              : "Past send attempts for this broadcast."}
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
        error={error ?? jobError}
        message={null}
        onDismissError={() => {
          setError(null);
          if (job?.phase === "failed") store.dismissJob(broadcastId);
        }}
      />

      {inProgress ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Activity className="size-4" />
              Current run
            </CardTitle>
            <CardDescription>
              {current
                ? `Started ${formatWhen(current.startedAt)}`
                : job?.message ?? "Starting…"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {current ? (
              <RunStats run={current} />
            ) : (
              <div className="space-y-3">
                <ProgressBar value={0} indeterminate />
                <p className="text-sm text-muted-foreground">
                  {job?.message ?? "Starting broadcast…"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-2">
        <div>
          <h3 className="text-sm font-semibold">Past runs</h3>
          <p className="text-xs text-muted-foreground">
            Latest broadcast send attempts.
          </p>
        </div>
        <PastRunsTable history={history} />
      </div>
    </div>
  );
}
