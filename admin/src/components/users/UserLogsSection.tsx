"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { EmailSenderAlerts } from "@/relaybase/components/EmailSenderShared";
import type { EmailSenderLogEntry } from "@/relaybase/components/types";
import type { UserLogSummary } from "@/lib/admin/user-profile";
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

type StatusFilter = "all" | "failed" | "success";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "failed", label: "Failed" },
  { value: "success", label: "Success" },
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

type UserLogsSectionProps = {
  userId: string;
  workerConnected: boolean;
};

export function UserLogsSection({
  userId,
  workerConnected,
}: UserLogsSectionProps) {
  const [logs, setLogs] = useState<EmailSenderLogEntry[]>([]);
  const [summary, setSummary] = useState<UserLogSummary | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(
    async (status: StatusFilter, force?: boolean) => {
      if (force) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          limit: "100",
          status,
        });
        const res = await fetch(
          `/api/users/${encodeURIComponent(userId)}/logs?${params}`,
          { cache: "no-store" },
        );
        const data = (await res.json()) as {
          logs?: EmailSenderLogEntry[];
          summary?: UserLogSummary;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "Failed to load logs");
        setLogs(data.logs ?? []);
        setSummary(data.summary ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load logs");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    void load(statusFilter);
  }, [statusFilter, load]);

  const selected = logs.find((log) => log.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((option) => (
            <Button
              key={option.value}
              size="sm"
              variant={statusFilter === option.value ? "default" : "outline"}
              onClick={() => {
                setStatusFilter(option.value);
                setSelectedId(null);
              }}
            >
              {option.label}
            </Button>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={refreshing}
          onClick={() => void load(statusFilter, true)}
        >
          <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <EmailSenderAlerts error={error} message={null} />

      {summary ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Send attempts</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">{summary.total}</p>
              <p className="text-xs text-muted-foreground">Matched to this user</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Failures</CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className={cn(
                  "text-2xl font-semibold tabular-nums",
                  summary.failed > 0 && "text-destructive",
                )}
              >
                {summary.failed}
              </p>
              <p className="text-xs text-muted-foreground">In loaded window</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Failures (24h)</CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className={cn(
                  "text-2xl font-semibold tabular-nums",
                  summary.failedLast24h > 0 && "text-destructive",
                )}
              >
                {summary.failedLast24h}
              </p>
              <p className="text-xs text-muted-foreground">Recent to investigate</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Send logs</CardTitle>
          <CardDescription>
            {workerConnected
              ? "Worker send attempts for this user's domain and API keys."
              : "Local dev send history — connect the worker for live logs."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && !logs.length ? (
            <p className="text-sm text-muted-foreground">Loading logs…</p>
          ) : !logs.length ? (
            <p className="text-sm text-muted-foreground">
              {statusFilter === "failed"
                ? "No failed sends for this user."
                : "No send logs for this user yet."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow
                    key={log.id}
                    className="cursor-pointer"
                    data-state={selectedId === log.id ? "selected" : undefined}
                    onClick={() =>
                      setSelectedId((current) =>
                        current === log.id ? null : log.id,
                      )
                    }
                  >
                    <TableCell className="text-xs whitespace-nowrap">
                      {formatDate(log.at)}
                    </TableCell>
                    <TableCell className="text-xs">{log.domain ?? "—"}</TableCell>
                    <TableCell className="max-w-[160px] truncate text-xs">
                      {log.to ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs">
                      {log.subject ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={log.ok ? "default" : "destructive"}>
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[240px] truncate text-xs">
                      {log.error ?? log.messageId ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selected ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Log detail</CardTitle>
            <CardDescription>{formatDate(selected.at)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <dl className="grid gap-2 text-xs">
              <div>
                <dt className="inline font-medium text-foreground">Status: </dt>
                <dd className="inline">
                  <Badge
                    variant={selected.ok ? "default" : "destructive"}
                    className="ml-1"
                  >
                    {selected.status}
                  </Badge>
                </dd>
              </div>
              {selected.domain ? (
                <div>
                  <dt className="inline font-medium text-foreground">Domain: </dt>
                  <dd className="inline">{selected.domain}</dd>
                </div>
              ) : null}
              {selected.from ? (
                <div>
                  <dt className="inline font-medium text-foreground">From: </dt>
                  <dd className="inline">{selected.from}</dd>
                </div>
              ) : null}
              {selected.to ? (
                <div>
                  <dt className="inline font-medium text-foreground">To: </dt>
                  <dd className="inline">{selected.to}</dd>
                </div>
              ) : null}
              {selected.subject ? (
                <div>
                  <dt className="inline font-medium text-foreground">Subject: </dt>
                  <dd className="inline">{selected.subject}</dd>
                </div>
              ) : null}
              {selected.keyLabel || selected.keyPrefix ? (
                <div>
                  <dt className="inline font-medium text-foreground">Key: </dt>
                  <dd className="inline font-mono">
                    {selected.keyLabel ? `${selected.keyLabel} · ` : ""}
                    {selected.keyPrefix ?? selected.keyId}
                  </dd>
                </div>
              ) : null}
              {selected.messageId ? (
                <div>
                  <dt className="inline font-medium text-foreground">Message ID: </dt>
                  <dd className="inline font-mono">{selected.messageId}</dd>
                </div>
              ) : null}
              {selected.error ? (
                <div>
                  <dt className="inline font-medium text-foreground">Error: </dt>
                  <dd className="inline text-destructive">{selected.error}</dd>
                </div>
              ) : null}
            </dl>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
