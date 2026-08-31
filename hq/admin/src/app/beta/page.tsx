"use client";

import { Copy, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

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
import type { EmailSenderLogEntry } from "@/relaybase/components/types";

const BETA_FROM = "beta@relaybase.xyz";

type BetaInvite = {
  uuid: string;
  email: string;
  createdAt: string;
  locale: {
    country?: string;
    city?: string;
    region?: string;
    timezone?: string;
  };
  browser: string;
  os: string;
  userAgent: string;
  downloads: { at: string }[];
  downloadCount: number;
  lastDownloadAt: string | null;
  downloadUrl: string;
};

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatLocation(locale: BetaInvite["locale"]) {
  const place = [locale.city, locale.region, locale.country]
    .filter(Boolean)
    .join(", ");
  if (place && locale.timezone) return `${place} · ${locale.timezone}`;
  return place || locale.timezone || "—";
}

function isBetaInviteLog(log: EmailSenderLogEntry) {
  const from = log.from?.trim().toLowerCase() ?? "";
  return from === BETA_FROM || from.endsWith(`<${BETA_FROM}>`);
}

function lastInviteEmail(
  email: string,
  logs: EmailSenderLogEntry[],
): EmailSenderLogEntry | null {
  const target = email.trim().toLowerCase();
  const matches = logs.filter((log) => {
    const to = log.to?.trim().toLowerCase() ?? "";
    return to === target || to.includes(target);
  });
  return matches[0] ?? null;
}

export default function BetaPage() {
  const [invites, setInvites] = useState<BetaInvite[]>([]);
  const [available, setAvailable] = useState(true);
  const [d1Message, setD1Message] = useState<string | null>(null);
  const [logs, setLogs] = useState<EmailSenderLogEntry[]>([]);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLogsError(null);
    try {
      const [invitesRes, logsRes] = await Promise.all([
        fetch("/api/beta", { cache: "no-store" }),
        fetch("/api/relaybase/logs?limit=100&status=all&domain=relaybase.xyz", {
          cache: "no-store",
        }),
      ]);

      const invitesData = (await invitesRes.json()) as {
        invites?: BetaInvite[];
        available?: boolean;
        message?: string;
        error?: string;
      };
      if (!invitesRes.ok) {
        throw new Error(invitesData.error ?? "Failed to load beta invites");
      }
      setInvites(invitesData.invites ?? []);
      setAvailable(invitesData.available !== false);
      setD1Message(invitesData.message ?? null);

      if (logsRes.ok) {
        const logsData = (await logsRes.json()) as {
          logs?: EmailSenderLogEntry[];
        };
        const betaLogs = (logsData.logs ?? [])
          .filter(isBetaInviteLog)
          .sort((a, b) => b.at.localeCompare(a.at));
        setLogs(betaLogs);
      } else {
        const logsData = (await logsRes.json().catch(() => ({}))) as {
          error?: string;
        };
        setLogs([]);
        setLogsError(
          "Invite emails are unavailable — configure the worker in Settings.",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selected = invites.find((invite) => invite.uuid === selectedId) ?? null;
  const downloaded = invites.filter((invite) => invite.downloadCount > 0).length;
  const neverDownloaded = invites.length - downloaded;

  const selectedEmail = useMemo(
    () => (selected ? lastInviteEmail(selected.email, logs) : null),
    [logs, selected],
  );

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto p-4">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Applicants</CardDescription>
              <CardTitle className="text-2xl">{invites.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Downloaded</CardDescription>
              <CardTitle className="text-2xl">{downloaded}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Never downloaded</CardDescription>
              <CardTitle className="text-2xl">{neverDownloaded}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>Beta</CardTitle>
              <CardDescription>
                Marketing signups from relaybase.xyz — applicants, personal
                download links, and invite-email send logs.
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void refresh()}
              disabled={loading}
            >
              <RefreshCw className="size-3.5" />
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : !available ? (
              <p className="text-sm text-muted-foreground">
                {d1Message ?? "D1 is not available."}
              </p>
            ) : invites.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No beta applicants yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Signed up</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Downloads</TableHead>
                    <TableHead>Last download</TableHead>
                    <TableHead>Invite email</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invites.map((invite) => {
                    const lastEmail = lastInviteEmail(invite.email, logs);
                    return (
                      <TableRow
                        key={invite.uuid}
                        className="cursor-pointer"
                        data-state={
                          selectedId === invite.uuid ? "selected" : undefined
                        }
                        onClick={() =>
                          setSelectedId((current) =>
                            current === invite.uuid ? null : invite.uuid,
                          )
                        }
                      >
                        <TableCell className="text-sm">{invite.email}</TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(invite.createdAt)}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                          {formatLocation(invite.locale)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {invite.browser} · {invite.os}
                        </TableCell>
                        <TableCell className="text-sm">
                          {invite.downloadCount}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(invite.lastDownloadAt)}
                        </TableCell>
                        <TableCell>
                          {lastEmail ? (
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={
                                  lastEmail.ok ? "default" : "destructive"
                                }
                              >
                                {lastEmail.ok ? "Sent" : "Failed"}
                              </Badge>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {formatDate(lastEmail.at)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {selected ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{selected.email}</CardTitle>
              <CardDescription>
                Signed up {formatDate(selected.createdAt)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <dl className="grid gap-2 text-xs">
                <div>
                  <dt className="inline font-medium text-foreground">
                    Location:{" "}
                  </dt>
                  <dd className="inline">{formatLocation(selected.locale)}</dd>
                </div>
                <div>
                  <dt className="inline font-medium text-foreground">
                    Client:{" "}
                  </dt>
                  <dd className="inline">
                    {selected.browser} · {selected.os}
                  </dd>
                </div>
                {selected.userAgent ? (
                  <div>
                    <dt className="inline font-medium text-foreground">
                      User agent:{" "}
                    </dt>
                    <dd className="inline break-all text-muted-foreground">
                      {selected.userAgent}
                    </dd>
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  <dt className="font-medium text-foreground">
                    Download link:
                  </dt>
                  <dd className="min-w-0 break-all font-mono">
                    {selected.downloadUrl}
                  </dd>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void copyLink(selected.downloadUrl)}
                  >
                    <Copy className="size-3.5" />
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
                {selectedEmail ? (
                  <div>
                    <dt className="inline font-medium text-foreground">
                      Last invite email:{" "}
                    </dt>
                    <dd className="inline">
                      <Badge
                        variant={selectedEmail.ok ? "default" : "destructive"}
                        className="ml-1"
                      >
                        {selectedEmail.ok ? "Sent" : "Failed"}
                      </Badge>{" "}
                      {formatDate(selectedEmail.at)}
                      {selectedEmail.error ? ` — ${selectedEmail.error}` : ""}
                    </dd>
                  </div>
                ) : null}
              </dl>
              <div>
                <p className="mb-2 text-xs font-medium">
                  Downloads ({selected.downloadCount})
                </p>
                {selected.downloads.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No DMG downloads recorded.
                  </p>
                ) : (
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {selected.downloads.map((download, index) => (
                      <li key={`${download.at}-${index}`}>
                        {formatDate(download.at)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Invite emails</CardTitle>
            <CardDescription>
              Product Worker send logs from {BETA_FROM}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {logsError ? (
              <p className="text-sm text-muted-foreground">{logsError}</p>
            ) : logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No beta invite send logs in the tracked window.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {formatDate(log.at)}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs">
                        {log.to ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-xs">
                        {log.subject ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={log.ok ? "default" : "destructive"}>
                          {log.ok ? "Sent" : "Failed"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[240px] truncate text-xs text-muted-foreground">
                        {log.error ?? log.messageId ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
