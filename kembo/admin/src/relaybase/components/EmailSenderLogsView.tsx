"use client";

import { useCallback, useEffect, useState } from "react";

import {
  useEmailSender,
  useEmailSenderCacheHint,
} from "@/relaybase/components/EmailSenderContext";
import {
  EmailSenderAlerts,
  EmailSenderToolbar,
} from "@/relaybase/components/EmailSenderShared";
import type {
  EmailSenderLogEntry,
  EmailSenderLogSummary,
} from "@/relaybase/components/types";
import { readCachedOrStale } from "@/lib/dashboard/shared/dashboard-client-cache";
import { RELAYBASE_CACHE_ID } from "@/relaybase/components/EmailSenderContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export function EmailSenderLogsView() {
  const { fetchLogs } = useEmailSender();
  const [logs, setLogs] = useState<EmailSenderLogEntry[]>([]);
  const [summary, setSummary] = useState<EmailSenderLogSummary | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("failed");
  const [domainFilter, setDomainFilter] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [logsMeta, setLogsMeta] = useState<import("@/lib/dashboard/shared/cached-fetch").CacheMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const cacheHint = useEmailSenderCacheHint(logsMeta);

  const queryKey = `${statusFilter}:${domainFilter.trim().toLowerCase()}`;

  const refresh = useCallback(
    async (force?: boolean) => {
      setRefreshing(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          limit: "100",
          status: statusFilter,
        });
        if (domainFilter.trim()) {
          params.set("domain", domainFilter.trim());
        }
        const { data, meta } = await fetchLogs(queryKey, params.toString(), {
          refresh: force,
          onUpdate: (next) => {
            setLogs(next.logs ?? []);
            setSummary(next.summary ?? null);
          },
        });
        setLogs(data.logs ?? []);
        setSummary(data.summary ?? null);
        setLogsMeta(meta);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Refresh failed");
      } finally {
        setRefreshing(false);
      }
    },
    [domainFilter, fetchLogs, queryKey, statusFilter],
  );

  useEffect(() => {
    const cached = readCachedOrStale<{
      logs?: EmailSenderLogEntry[];
      summary?: EmailSenderLogSummary;
    }>(RELAYBASE_CACHE_ID, "relaybase", `logs:${queryKey}`);
    if (cached) {
      setLogs(cached.logs ?? []);
      setSummary(cached.summary ?? null);
    }
    void refresh();
  }, [refresh, queryKey]);

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
        <EmailSenderToolbar
          refreshing={refreshing}
          onRefresh={() => void refresh(true)}
          cacheHint={cacheHint}
        />
      </div>

      <EmailSenderAlerts error={error} message={null} />

      {summary ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Tracked sends</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">
                {summary.total}
              </p>
              <p className="text-xs text-muted-foreground">
                Last {summary.total} worker send attempts
              </p>
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
              <p className="text-xs text-muted-foreground">In tracked window</p>
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
              <p className="text-xs text-muted-foreground">
                Recent failures to investigate
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-end justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-sm">Send logs</CardTitle>
            <CardDescription>
              Worker-side send attempts from Relaybase, including API
              validation and Cloudflare delivery failures.
            </CardDescription>
          </div>
          <div className="w-full max-w-xs space-y-1">
            <Label className="text-xs">Filter by domain</Label>
            <Input
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
              placeholder="yourdomain.com"
              onKeyDown={(e) => {
                if (e.key === "Enter") void refresh();
              }}
            />
          </div>
        </CardHeader>
        <CardContent>
          {!logs.length ? (
            <p className="text-sm text-muted-foreground">
              {statusFilter === "failed"
                ? "No failed sends in the tracked window."
                : "No send logs yet."}
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
                    <TableCell className="text-xs">
                      {log.domain ?? "—"}
                    </TableCell>
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
                  <dt className="inline font-medium text-foreground">
                    Domain:{" "}
                  </dt>
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
                  <dt className="inline font-medium text-foreground">
                    Subject:{" "}
                  </dt>
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
                  <dt className="inline font-medium text-foreground">
                    Message ID:{" "}
                  </dt>
                  <dd className="inline font-mono">{selected.messageId}</dd>
                </div>
              ) : null}
              {selected.error ? (
                <div>
                  <dt className="inline font-medium text-foreground">
                    Error:{" "}
                  </dt>
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
