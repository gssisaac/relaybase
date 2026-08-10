"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  desktopAwareFetch,
  friendlyDesktopFetchError,
  readResponseJson,
} from "@/lib/desktop/api-base";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "failed" | "success";

type OpsLogEntry = {
  id: string;
  at: string;
  kind: "send" | "bounce" | "api_error";
  ok: boolean;
  status: number | null;
  source: "compose" | "api" | "broadcast" | "inbound";
  domain: string | null;
  fromAddr: string | null;
  toAddr: string | null;
  subject: string | null;
  messageId: string | null;
  error: string | null;
  keyId: string | null;
  keyPrefix: string | null;
  metaJson: string | null;
};

type LogsResponse = {
  logs: OpsLogEntry[];
  summary: {
    total: number;
    failed: number;
    failedLast24h: number;
  };
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

function sourceLabel(source: OpsLogEntry["source"]) {
  switch (source) {
    case "compose":
      return "Compose";
    case "api":
      return "API";
    case "broadcast":
      return "Broadcast";
    case "inbound":
      return "Inbound";
    default:
      return source;
  }
}

function kindLabel(kind: OpsLogEntry["kind"]) {
  switch (kind) {
    case "send":
      return "Send";
    case "bounce":
      return "Bounce";
    case "api_error":
      return "API Error";
    default:
      return kind;
  }
}

function peerFor(log: OpsLogEntry) {
  if (log.kind === "bounce" || log.source === "inbound") {
    return log.toAddr || log.fromAddr || "—";
  }
  return log.toAddr || log.fromAddr || "—";
}

export function LogsView() {
  const { apiBase } = useEmailPaths();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [domainFilter, setDomainFilter] = useState("");
  const [data, setData] = useState<LogsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(
    async (nextStatus: StatusFilter, nextDomain: string, force?: boolean) => {
      setError(null);
      if (!force) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const params = new URLSearchParams({
          status: nextStatus,
          limit: "150",
        });
        if (nextDomain.trim()) {
          params.set("domain", nextDomain.trim().toLowerCase());
        }
        const res = await desktopAwareFetch(`${apiBase}/logs?${params}`, {
          cache: "no-store",
        });
        const json = await readResponseJson<LogsResponse & { error?: string }>(
          res,
        );
        if (!res.ok) throw new Error(json.error ?? "Failed to load logs");
        setData(json);
      } catch (e) {
        setError(friendlyDesktopFetchError(e, "Failed to load logs"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [apiBase],
  );

  useEffect(() => {
    void load(statusFilter, domainFilter);
  }, [load, statusFilter, domainFilter]);

  const logs = data?.logs ?? [];
  const selected = logs.find((log) => log.id === selectedId) ?? null;
  const summary = data?.summary;

  const domainDebounce = useMemo(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return (value: string) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        setDomainFilter(value);
      }, 300);
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Logs</h2>
          <p className="text-xs text-muted-foreground">
            Send, bounce, and API events across all accounts
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
          <Input
            placeholder="Filter by domain…"
            defaultValue={domainFilter}
            onChange={(e) => domainDebounce(e.target.value)}
            className="h-8 w-40 text-xs"
          />
          <Button
            variant="outline"
            size="sm"
            disabled={refreshing}
            onClick={() => void load(statusFilter, domainFilter, true)}
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
            Failed{" "}
            <span className="tabular-nums text-foreground">{summary.failed}</span>
          </span>
          <span>·</span>
          <span>
            Failed 24h{" "}
            <span className="tabular-nums text-foreground">
              {summary.failedLast24h}
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

      <Table>
        <TableHeader>
          <TableRow className="border-b hover:bg-transparent">
            <TableHead className="w-[140px]">When</TableHead>
            <TableHead className="w-[90px]">Source</TableHead>
            <TableHead className="w-[80px]">Status</TableHead>
            <TableHead className="w-[90px]">Kind</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead className="hidden sm:table-cell">Peer</TableHead>
            <TableHead className="hidden md:table-cell">Domain</TableHead>
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
              <TableCell>
                <Badge variant="outline" className="text-[10px]">
                  {kindLabel(log.kind)}
                </Badge>
              </TableCell>
              <TableCell className="max-w-[240px] truncate text-sm">
                {log.subject || "—"}
              </TableCell>
              <TableCell className="hidden max-w-[200px] truncate text-xs text-muted-foreground sm:table-cell">
                {peerFor(log)}
              </TableCell>
              <TableCell className="hidden max-w-[140px] truncate text-xs text-muted-foreground md:table-cell">
                {log.domain || "—"}
              </TableCell>
            </TableRow>
          ))}
          {!loading && logs.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="py-10 text-center text-sm text-muted-foreground"
              >
                No logs yet.
              </TableCell>
            </TableRow>
          ) : null}
          {loading && logs.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="py-10 text-center text-sm text-muted-foreground"
              >
                Loading…
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>

      {selected ? (
        <div className="space-y-2 rounded-lg border border-border p-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{sourceLabel(selected.source)}</Badge>
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
            {selected.status != null ? (
              <div>
                <dt className="text-muted-foreground">HTTP status</dt>
                <dd className="tabular-nums">{selected.status}</dd>
              </div>
            ) : null}
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
            {selected.metaJson ? (
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Details</dt>
                <dd className="break-all font-mono text-xs text-muted-foreground">
                  {selected.metaJson}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}
    </div>
  );
}
