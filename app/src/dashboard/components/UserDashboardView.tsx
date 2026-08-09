"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { ApiActivityChart } from "@/dashboard/components/ApiActivityChart";
import {
  dashboardCacheNeedsRefresh,
  loadDashboardStatsCache,
  saveDashboardStatsCache,
} from "@/lib/dashboard/dashboard-cache-disk";
import { useDomain } from "@/lib/dashboard/DomainContext";
import { useEmailPaths } from "@/email/paths";
import { EmailAlerts } from "@/email/components/EmailShared";
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

type StatsRange = "24h" | "7d" | "30d";

type UserStatsResponse = {
  domain: string | null;
  range: StatsRange;
  workerConnected?: boolean;
  totals: {
    domains: number;
    addresses: number;
    audience: number;
    broadcasts: number;
    drafts: number;
    sent: number;
    apiKeys: number;
    apiKeysUsed: number;
    requests: number;
    errors: number;
    apiEmails: number;
  };
  series: {
    sent: { value: number; label: string }[];
    apiKeysUsed: { value: number; label: string }[];
    requests: { value: number; label: string }[];
    errors: { value: number; label: string }[];
    apiEmails: { value: number; label: string }[];
  };
};

const RANGE_OPTIONS: { value: StatsRange; label: string }[] = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
];

const KPI_CARDS = [
  {
    key: "domains" as const,
    label: "Domains",
    description: "Connected domains",
    href: "domains",
  },
  {
    key: "addresses" as const,
    label: "Accounts",
    description: "Registered addresses",
    href: "accounts",
  },
  {
    key: "broadcasts" as const,
    label: "Broadcasts",
    description: "Campaigns across domains",
    href: "broadcasts",
  },
  {
    key: "audience" as const,
    label: "Audience",
    description: "Contacts for broadcasts",
    href: "audience",
  },
];

const API_METRIC_CARDS = [
  {
    key: "requests" as const,
    label: "API requests",
    href: "keys",
  },
  {
    key: "apiEmails" as const,
    label: "API emails",
    href: "keys",
  },
  {
    key: "errors" as const,
    label: "Errors",
    href: "keys",
  },
  {
    key: "apiKeys" as const,
    label: "API keys",
    href: "keys",
  },
];

export function UserDashboardView() {
  const { domains } = useDomain();
  const { base } = useEmailPaths();
  const [range, setRange] = useState<StatsRange>("7d");
  const [stats, setStats] = useState<UserStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextRange: StatsRange, force?: boolean) => {
    setError(null);

    const cached = await loadDashboardStatsCache<UserStatsResponse>(nextRange);
    if (cached) {
      setStats(cached.data);
      setLoading(false);
    } else {
      // Don't flash another range's totals while the first fetch runs.
      setStats(null);
    }

    const needsNetwork =
      force === true ||
      !cached ||
      dashboardCacheNeedsRefresh(cached.fetchedAt);

    if (!needsNetwork) return;

    // Keep cached numbers on screen; only spin the refresh control.
    if (cached) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch(`/api/email/stats?range=${nextRange}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as UserStatsResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load stats");
      setStats(data);
      await saveDashboardStatsCache(nextRange, data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load stats");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(range);
  }, [load, range]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <DesktopTitleBar
        className="px-4 py-3"
        end={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load(range, true)}
            disabled={refreshing}
          >
            <RefreshCw
              className={refreshing ? "size-4 animate-spin" : "size-4"}
            />
          </Button>
        }
      >
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview across all domains
          </p>
        </div>
      </DesktopTitleBar>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
        <div className="mx-auto w-full max-w-[1200px] space-y-6 p-4">
          <EmailAlerts error={error} message={null} />

          {!domains.length && !loading ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Get started</CardTitle>
                <CardDescription>
                  Refresh domains from your Cloudflare account to unlock
                  accounts, email, broadcasts, and audience tools.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  size="sm"
                  nativeButton={false}
                  render={<Link href={`${base}/domains`} />}
                >
                  Refresh from Cloudflare
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {KPI_CARDS.map((card) => {
              const value = stats?.totals[card.key] ?? 0;
              return (
                <Card
                  key={card.key}
                  className="transition-colors hover:bg-accent/30"
                >
                  <Link href={`${base}/${card.href}`} className="block">
                    <CardHeader className="pb-2">
                      <CardDescription>{card.label}</CardDescription>
                      <CardTitle className="text-4xl font-semibold tracking-tight tabular-nums">
                        {loading && !stats ? "—" : value.toLocaleString()}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        {card.description}
                      </p>
                      {card.key === "broadcasts" && stats ? (
                        <Badge variant="secondary">
                          {stats.totals.drafts} drafts
                        </Badge>
                      ) : null}
                    </CardContent>
                  </Link>
                </Card>
              );
            })}
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                API activity
              </h2>
              <div className="flex flex-wrap items-center gap-2">
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
                {stats ? (
                  <Badge
                    variant={stats.workerConnected ? "default" : "secondary"}
                  >
                    {stats.workerConnected
                      ? "Worker connected"
                      : "Worker offline"}
                  </Badge>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              {API_METRIC_CARDS.map((card) => {
                const value = stats?.totals[card.key] ?? 0;
                return (
                  <Card
                    key={card.key}
                    className="transition-colors hover:bg-accent/30"
                  >
                    <Link href={`${base}/${card.href}`} className="block">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">{card.label}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p
                          className={cn(
                            "text-2xl font-semibold tabular-nums",
                            card.key === "errors" &&
                              value > 0 &&
                              "text-destructive",
                          )}
                        >
                          {loading && !stats ? "—" : value.toLocaleString()}
                        </p>
                        {card.key === "apiKeys" && stats ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {stats.totals.apiKeysUsed} used in range
                          </p>
                        ) : null}
                      </CardContent>
                    </Link>
                  </Card>
                );
              })}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Request volume</CardTitle>
                <CardDescription>
                  API requests across all domains
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ApiActivityChart
                  requests={stats?.series.requests ?? []}
                  errors={stats?.series.errors ?? []}
                  range={range}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
