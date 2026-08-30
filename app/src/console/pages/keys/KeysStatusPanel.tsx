"use client";

import { useCallback, useEffect, useState } from "react";

import { SparklineChart } from "@/components/dashboard/SparklineChart";
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
import {
  desktopAwareFetch,
  friendlyDesktopFetchError,
  isApiUnavailableError,
  readResponseJson,
} from "@/lib/desktop/api";
import { cn } from "@/lib/utils";

export type StatsRange = "24h" | "7d" | "30d";

type KeysStats = {
  totals: {
    requests: number;
    errors: number;
    emails: number;
  };
  series: {
    requests: { value: number; label: string }[];
  };
};

type OpsLogEntry = {
  id: string;
  at: string;
  kind: "send" | "bounce" | "api_error" | "inbound";
  ok: boolean;
  status: number | null;
  source: "compose" | "api" | "broadcast" | "inbound";
  domain: string | null;
  fromAddr: string | null;
  toAddr: string | null;
  subject: string | null;
  error: string | null;
  keyPrefix: string | null;
};

type LogsResponse = {
  logs: OpsLogEntry[];
  workerConnected?: boolean;
};

const RANGE_OPTIONS: { value: StatsRange; label: string }[] = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
];

const LOG_PAGE_SIZE = 20;

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function kindLabel(kind: OpsLogEntry["kind"]) {
  switch (kind) {
    case "send":
      return "Send";
    case "bounce":
      return "Bounce";
    case "api_error":
      return "API Error";
    case "inbound":
      return "Receive";
    default:
      return kind;
  }
}

export function KeysStatusPanel({
  apiBase,
  refreshNonce,
}: {
  apiBase: string;
  refreshNonce: number;
}) {
  const [range, setRange] = useState<StatsRange>("7d");
  const [stats, setStats] = useState<KeysStats | null>(null);
  const [logs, setLogs] = useState<OpsLogEntry[]>([]);
  const [logLimit, setLogLimit] = useState(LOG_PAGE_SIZE);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadStats = useCallback(
    async (nextRange: StatsRange) => {
      setLoadingStats(true);
      try {
        const res = await desktopAwareFetch(
          `${apiBase}/stats?range=${encodeURIComponent(nextRange)}`,
          { cache: "no-store" },
        );
        const data = await readResponseJson<
          KeysStats & { error?: string }
        >(res);
        if (!res.ok) throw new Error(data.error ?? "Failed to load stats");
        setStats({
          totals: {
            requests: data.totals?.requests ?? 0,
            errors: data.totals?.errors ?? 0,
            emails: data.totals?.emails ?? 0,
          },
          series: {
            requests: data.series?.requests ?? [],
          },
        });
      } catch (e) {
        if (!isApiUnavailableError(e)) {
          setError(friendlyDesktopFetchError(e, "Failed to load stats"));
        }
      } finally {
        setLoadingStats(false);
      }
    },
    [apiBase],
  );

  const loadLogs = useCallback(
    async (nextLimit: number, more?: boolean) => {
      if (more) setLoadingMore(true);
      else setLoadingLogs(true);
      try {
        const params = new URLSearchParams({
          limit: String(nextLimit),
        });
        const res = await desktopAwareFetch(`${apiBase}/logs?${params}`, {
          cache: "no-store",
        });
        const data = await readResponseJson<LogsResponse & { error?: string }>(
          res,
        );
        if (!res.ok) throw new Error(data.error ?? "Failed to load logs");
        setLogs(data.logs ?? []);
      } catch (e) {
        if (!isApiUnavailableError(e)) {
          setError(friendlyDesktopFetchError(e, "Failed to load logs"));
        }
      } finally {
        setLoadingLogs(false);
        setLoadingMore(false);
      }
    },
    [apiBase],
  );

  useEffect(() => {
    setError(null);
    void loadStats(range);
  }, [loadStats, range, refreshNonce]);

  useEffect(() => {
    setError(null);
    void loadLogs(logLimit, logLimit > LOG_PAGE_SIZE);
  }, [loadLogs, logLimit, refreshNonce]);

  const requestSeries = stats?.series?.requests?.map((b) => b.value) ?? [];
  const requestTotal = stats?.totals?.requests ?? 0;
  const errorTotal = stats?.totals?.errors ?? 0;
  const selected = logs.find((log) => log.id === selectedId) ?? null;
  const hasMore = logs.length >= logLimit;

  return (
    <div className="space-y-4">
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div>
            <CardDescription>Send API requests</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {loadingStats && !stats ? "—" : requestTotal.toLocaleString()}
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {errorTotal > 0 ? (
                <span className="text-destructive">
                  {errorTotal.toLocaleString()} errors
                </span>
              ) : (
                "No errors"
              )}
              {" · "}
              {range}
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            {RANGE_OPTIONS.map((option) => (
              <Button
                key={option.value}
                size="sm"
                variant={range === option.value ? "default" : "outline"}
                onClick={() => setRange(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <SparklineChart
            data={requestSeries}
            color="#22c55e"
            className="h-28"
            height={112}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recent logs</CardTitle>
          <CardDescription>
            Latest {logs.length || LOG_PAGE_SIZE} send and API events
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Table>
            <TableHeader>
              <TableRow className="border-b hover:bg-transparent">
                <TableHead className="w-[140px]">When</TableHead>
                <TableHead className="w-[80px]">Status</TableHead>
                <TableHead className="w-[90px]">Kind</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead className="hidden sm:table-cell">Domain</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="[&_tr]:border-0">
              {logs.map((log) => (
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
                    <Badge
                      variant={log.ok ? "default" : "destructive"}
                      className="text-[10px]"
                    >
                      {log.ok ? "OK" : "Failed"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {kindLabel(log.kind)}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[240px] truncate text-sm">
                    {log.subject || "—"}
                  </TableCell>
                  <TableCell className="hidden max-w-[140px] truncate text-xs text-muted-foreground sm:table-cell">
                    {log.domain || "—"}
                  </TableCell>
                </TableRow>
              ))}
              {!loadingLogs && logs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    No logs yet.
                  </TableCell>
                </TableRow>
              ) : null}
              {loadingLogs && logs.length === 0 ? (
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

          {selected ? (
            <div className="space-y-2 rounded-lg border border-border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{kindLabel(selected.kind)}</Badge>
                <Badge variant={selected.ok ? "default" : "destructive"}>
                  {selected.ok ? "OK" : "Failed"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatDate(selected.at)}
                </span>
              </div>
              <p className="font-medium">{selected.subject || "—"}</p>
              <dl className="grid gap-2 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">From</dt>
                  <dd>{selected.fromAddr || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">To</dt>
                  <dd>{selected.toAddr || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Domain</dt>
                  <dd>{selected.domain || "—"}</dd>
                </div>
                {selected.keyPrefix ? (
                  <div>
                    <dt className="text-muted-foreground">API key</dt>
                    <dd>{selected.keyPrefix}</dd>
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

          {hasMore ? (
            <div className="flex justify-center">
              <Button
                size="sm"
                variant="outline"
                disabled={loadingMore}
                onClick={() => setLogLimit((n) => n + LOG_PAGE_SIZE)}
              >
                {loadingMore ? "Loading…" : "Load more"}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
