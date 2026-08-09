"use client";

import { useDashboardDomain } from "@/dashboard/hooks/useDashboardDomain";
import { useDashboardPaths } from "@/dashboard/paths";
import {
  fetchEmailCached,
  fetchEmailCachedOptional,
} from "@/email/components/email-cached-fetch";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  cacheHintText,
  oldestCacheMeta,
} from "@/lib/dashboard/shared/cached-fetch";
import { useProductId } from "@/lib/dashboard/shared/ProductContext";

import {
  EmailAlerts,
  PageToolbar,
  StatusBadge,
} from "@/email/components/EmailShared";
import { readEmailStale } from "@/email/components/useEmailViewLoading";
import type { DomainStatus, EmailMetrics } from "@/email/components/types";
import { Badge } from "@/components/ui/badge";
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

export function MetricsView() {
  const productId = useProductId();
  const { apiBase, domains } = useDashboardPaths();
  const { domain, domainQuery } = useDashboardDomain();
  const domainKey = domain ?? "none";
  const [metrics, setMetrics] = useState<EmailMetrics | null>(null);
  const [status, setStatus] = useState<DomainStatus | null>(null);
  const [loading, setLoading] = useState(
    () =>
      readEmailStale<EmailMetrics>(productId, `metrics:${domainKey}`) === null &&
      readEmailStale<DomainStatus>(productId, `status:${domainKey}`) === null,
  );
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheHint, setCacheHint] = useState<string | null>(null);

  const dataRef = useRef({ metrics, status });
  dataRef.current = { metrics, status };

  useEffect(() => {
    const staleMetrics = readEmailStale<EmailMetrics>(
      productId,
      `metrics:${domainKey}`,
    );
    if (staleMetrics) setMetrics(staleMetrics);
    const staleStatus = readEmailStale<DomainStatus>(
      productId,
      `status:${domainKey}`,
    );
    if (staleStatus) setStatus(staleStatus);
    if (staleMetrics || staleStatus) setLoading(false);
  }, [domainKey, productId]);

  const refresh = useCallback(
    async (force?: boolean) => {
      if (!domain) {
        setLoading(false);
        setRefreshing(false);
        return;
      }
      const hasData =
        dataRef.current.metrics !== null || dataRef.current.status !== null;
      if (!hasData) setLoading(true);
      setRefreshing(true);
      setError(null);
      try {
        const qs = domainQuery();
        const [metricsResult, statusResult] = await Promise.all([
          fetchEmailCached<EmailMetrics>(
            productId,
            `metrics:${domainKey}`,
            `${apiBase}/metrics${qs}`,
            {
              refresh: force,
              onUpdate: (data) => setMetrics(data),
            },
          ),
          fetchEmailCachedOptional<DomainStatus>(
            productId,
            `status:${domainKey}`,
            `${apiBase}/status${qs}`,
            {
              refresh: force,
              onUpdate: (data) => {
                if (data) setStatus(data);
              },
            },
          ),
        ]);
        setMetrics(metricsResult.data);
        if (statusResult.ok) setStatus(statusResult.data);
        const meta = oldestCacheMeta(metricsResult.meta, statusResult.meta);
        setCacheHint(cacheHintText(meta?.fromCache ?? false, meta?.ageMinutes ?? 0));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Refresh failed");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [apiBase, domain, domainKey, domainQuery, productId],
  );

  useEffect(() => {
    refresh();
  }, [refresh, domain]);

  const statCards = metrics
    ? [
        { label: "Routing activity", value: metrics.routingActivityCount },
        { label: "Audience", value: metrics.audienceCount },
        { label: "Senders", value: metrics.senderCount },
        { label: "Broadcasts sent", value: metrics.broadcastsSent },
        {
          label: "DNS records OK",
          value: `${metrics.dnsOk}/${metrics.dnsTotal}`,
        },
      ]
    : [];

  const placeholderLabels = [
    "Routing activity",
    "Audience",
    "Senders",
    "Broadcasts sent",
    "DNS records OK",
  ];

  return (
    <div className="min-h-[min(70vh,560px)] space-y-4">
      <PageToolbar
        refreshing={refreshing}
        cacheHint={cacheHint}
        onRefresh={() => refresh(true)}
      />
      <EmailAlerts error={error} message={null} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {(metrics ? statCards : placeholderLabels.map((label) => ({ label, value: "—" }))).map(
          (s) => (
            <Card key={s.label}>
              <CardHeader className="pb-1">
                <CardDescription className="text-xs">{s.label}</CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums">
                  {s.value}
                </CardTitle>
              </CardHeader>
            </Card>
          ),
        )}
      </div>

      {metrics ? (
        <Card>
            <CardHeader>
              <CardTitle className="text-sm">Domain health</CardTitle>
              <CardDescription>
                <span className="font-mono">{metrics.domain || "—"}</span> · manage
                in{" "}
                <Link href={domains} className="underline">
                  Domains
                </Link>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <StatusBadge
                  ok={metrics.sendingEnabled}
                  labelOk="Sending enabled"
                  labelBad="Sending off"
                />
                <StatusBadge
                  ok={metrics.routingEnabled}
                  labelOk="Routing enabled"
                  labelBad="Routing off"
                />
                <StatusBadge
                  ok={metrics.relaybaseConfigured}
                  labelOk="Relaybase configured"
                  labelBad="Relaybase missing"
                />
                <StatusBadge
                  ok={metrics.cloudflareConfigured}
                  labelOk="Cloudflare configured"
                  labelBad="Cloudflare missing"
                />
              </div>
              {status?.dnsRecords && status.dnsRecords.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Expected</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {status.dnsRecords.map((r, i) => (
                      <TableRow
                        key={`${r.type}-${r.name}-${r.expected}-${i}`}
                      >
                        <TableCell className="font-mono text-xs">{r.type}</TableCell>
                        <TableCell className="max-w-[200px] truncate font-mono text-xs">
                          {r.name}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {r.expected}
                        </TableCell>
                        <TableCell>
                          {r.found ? (
                            <Badge variant="default">OK</Badge>
                          ) : (
                            <Badge variant="secondary">Missing</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : null}
            </CardContent>
          </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Domain health</CardTitle>
            <CardDescription>
              DNS and connection status for your email domain.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="min-h-[120px]" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
