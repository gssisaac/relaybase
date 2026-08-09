"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmailAlerts } from "@/email/components/EmailShared";
import { useEmailPaths } from "@/email/paths";
import {
  dashboardCacheNeedsRefresh,
  loadAccountLogsCache,
  saveAccountLogsCache,
} from "@/lib/dashboard/dashboard-cache-disk";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "failed" | "success";

type AccountLogEntry = {
  id: string;
  at: string;
  source: "api" | "dashboard" | "inbound";
  direction: "sent" | "received";
  ok: boolean;
  from: string;
  to: string;
  subject: string;
  error?: string;
  keyPrefix?: string | null;
  keyLabel?: string | null;
  status?: number | null;
};

type AccountLogsResponse = {
  summary: {
    total: number;
    success: number;
    failed: number;
    api: number;
    dashboard: number;
    inbound: number;
  };
  logs: AccountLogEntry[];
  workerConnected: boolean;
};

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "success", label: "Success" },
  { value: "failed", label: "Failed" },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function sourceLabel(source: AccountLogEntry["source"]) {
  if (source === "api") return "API";
  if (source === "dashboard") return "Dashboard";
  return "Inbound";
}

export function AccountLogsView({ email }: { email: string }) {
  const { apiBase } = useEmailPaths();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [data, setData] = useState<AccountLogsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(
    async (nextStatus: StatusFilter, force?: boolean) => {
      setError(null);

      const cached = await loadAccountLogsCache<AccountLogsResponse>(
        email,
        nextStatus,
      );
      if (cached) {
        setData(cached.data);
        setLoading(false);
      } else {
        setData(null);
      }

      const needsNetwork =
        force === true ||
        !cached ||
        dashboardCacheNeedsRefresh(cached.fetchedAt);

      if (!needsNetwork) return;

      // Keep cached rows on screen; only spin the refresh control.
      if (cached) setRefreshing(true);
      else setLoading(true);

      try {
        const params = new URLSearchParams({
          email,
          status: nextStatus,
          limit: "150",
        });
        const res = await fetch(`${apiBase}/account-logs?${params}`, {
          cache: "no-store",
        });
        const json = (await res.json()) as AccountLogsResponse & {
          error?: string;
        };
        if (!res.ok) throw new Error(json.error ?? "Failed to load logs");
        setData(json);
        await saveAccountLogsCache(email, nextStatus, json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load logs");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [apiBase, email],
  );

  useEffect(() => {
    void load(statusFilter);
  }, [load, statusFilter]);

  const logs = data?.logs ?? [];
  const selected = logs.find((log) => log.id === selectedId) ?? null;
  const summary = data?.summary;

  return (
    <div className="mx-auto w-full max-w-[1000px] space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Logs</h2>
          <p className="text-xs text-muted-foreground">
            API, dashboard, and inbound activity for {email}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg bg-muted p-0.5">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatusFilter(option.value)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs",
                  statusFilter === option.value
                    ? "bg-background font-medium shadow-sm"
                    : "text-muted-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={refreshing}
            onClick={() => void load(statusFilter, true)}
          >
            <RefreshCw
              className={refreshing ? "size-4 animate-spin" : "size-4"}
            />
          </Button>
        </div>
      </div>

      <EmailAlerts error={error} message={null} />

      {summary ? (
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>
            Total{" "}
            <span className="tabular-nums text-foreground">{summary.total}</span>
          </span>
          <span>·</span>
          <span>
            API{" "}
            <span className="tabular-nums text-foreground">{summary.api}</span>
          </span>
          <span>·</span>
          <span>
            Dashboard{" "}
            <span className="tabular-nums text-foreground">
              {summary.dashboard}
            </span>
          </span>
          <span>·</span>
          <span>
            Inbound{" "}
            <span className="tabular-nums text-foreground">
              {summary.inbound}
            </span>
          </span>
          {!data?.workerConnected ? (
            <>
              <span>·</span>
              <span className="text-amber-600">Worker not connected</span>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">When</TableHead>
              <TableHead className="w-[90px]">Source</TableHead>
              <TableHead className="w-[80px]">Status</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead className="hidden sm:table-cell">Peer</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => {
              const peer = log.direction === "sent" ? log.to : log.from;
              return (
                <TableRow
                  key={log.id}
                  className={cn(
                    "cursor-pointer",
                    selectedId === log.id && "bg-muted/50",
                  )}
                  onClick={() =>
                    setSelectedId((prev) => (prev === log.id ? null : log.id))
                  }
                >
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDate(log.at)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {sourceLabel(log.source)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={log.ok ? "default" : "destructive"}
                      className="text-[10px]"
                    >
                      {log.ok ? "OK" : "Failed"}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[240px] truncate text-sm">
                    {log.subject}
                  </TableCell>
                  <TableCell className="hidden max-w-[200px] truncate text-xs text-muted-foreground sm:table-cell">
                    {peer || "—"}
                  </TableCell>
                </TableRow>
              );
            })}
            {!loading && logs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No logs for this account yet.
                </TableCell>
              </TableRow>
            ) : null}
            {loading && logs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  Loading…
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      {selected ? (
        <div className="space-y-2 rounded-lg border border-border p-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{sourceLabel(selected.source)}</Badge>
            <Badge variant={selected.ok ? "default" : "destructive"}>
              {selected.ok ? "OK" : "Failed"}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatDate(selected.at)}
            </span>
          </div>
          <p className="font-medium">{selected.subject}</p>
          <dl className="grid gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">From</dt>
              <dd>{selected.from || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">To</dt>
              <dd>{selected.to || "—"}</dd>
            </div>
            {selected.keyPrefix || selected.keyLabel ? (
              <div>
                <dt className="text-muted-foreground">API key</dt>
                <dd>
                  {selected.keyLabel || selected.keyPrefix || "—"}
                </dd>
              </div>
            ) : null}
            {selected.status != null ? (
              <div>
                <dt className="text-muted-foreground">HTTP status</dt>
                <dd className="tabular-nums">{selected.status}</dd>
              </div>
            ) : null}
            {selected.error ? (
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Error</dt>
                <dd className="text-destructive">{selected.error}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}
    </div>
  );
}
