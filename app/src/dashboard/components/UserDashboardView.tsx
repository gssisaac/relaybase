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
import {
  desktopAwareFetch,
  friendlyDesktopFetchError,
  isPackagedApiUnavailableError,
  readResponseJson,
} from "@/lib/desktop/api-base";
import { useDashboardPaths } from "@/dashboard/paths";
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
    path: "domains" as const,
  },
  {
    key: "addresses" as const,
    label: "Accounts",
    description: "Registered addresses",
    path: "accounts" as const,
  },
  {
    key: "broadcasts" as const,
    label: "Broadcasts",
    description: "Campaigns across domains",
    path: "broadcasts" as const,
  },
  {
    key: "audience" as const,
    label: "Audience",
    description: "Contacts for broadcasts",
    path: "audience" as const,
  },
];

const API_METRIC_CARDS = [
  {
    key: "requests" as const,
    label: "API requests",
    path: "keys" as const,
  },
  {
    key: "apiEmails" as const,
    label: "API emails",
    path: "keys" as const,
  },
  {
    key: "errors" as const,
    label: "Errors",
    path: "keys" as const,
  },
  {
    key: "apiKeys" as const,
    label: "API keys",
    path: "keys" as const,
  },
];

export function UserDashboardView() {
  const { domains } = useDomain();
  const paths = useDashboardPaths();
  const [range, setRange] = useState<StatsRange>("7d");
  const [stats, setStats] = useState<UserStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextRange: StatsRange, force?: boolean) => {
    setError(null);

    const cached = await loadDashboardStatsCache<UserStatsResponse>(nextRange);
    if (cached?.data?.totals && cached.data.series) {
      setStats(cached.data);
      setLoading(false);
    } else {
      // Don't flash another range's totals while the first fetch runs.
      setStats(null);
    }

    const needsNetwork =
      force === true ||
      !cached?.data?.totals ||
      !cached.data.series ||
      dashboardCacheNeedsRefresh(cached.fetchedAt);

    if (!needsNetwork) return;

    // Keep cached numbers on screen; only spin the refresh control.
    if (cached) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await desktopAwareFetch(`/api/email/stats?range=${nextRange}`, {
        cache: "no-store",
      });
      const data = await readResponseJson<UserStatsResponse & { error?: string }>(
        res,
      );
      if (!res.ok) throw new Error(data.error ?? "Failed to load stats");
      if (!data.totals || !data.series) {
        throw new Error("Stats response missing totals/series");
      }
      setStats(data);
      await saveDashboardStatsCache(nextRange, data);
    } catch (e) {
      // Keep cached KPIs; don't flash WebKit / packaged-unwired noise.
      if (!cached && !isPackagedApiUnavailableError(e)) {
        setError(friendlyDesktopFetchError(e, "Failed to load stats"));
      } else {
        setError(null);
      }
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
                  render={<Link href={paths.domains} />}
                >
                  Refresh from Cloudflare
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {KPI_CARDS.map((card) => {
              const value = stats?.totals?.[card.key] ?? 0;
              const href = paths[card.path];
              return (
                <Card
                  key={card.key}
                  className="transition-colors hover:bg-accent/30"
                >
                  <Link href={href} className="block">
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
                      {card.key === "broadcasts" && stats?.totals ? (
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
                const value = stats?.totals?.[card.key] ?? 0;
                const href = paths[card.path];
                return (
                  <Card
                    key={card.key}
                    className="transition-colors hover:bg-accent/30"
                  >
                    <Link href={href} className="block">
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
                        {card.key === "apiKeys" && stats?.totals ? (
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
                  requests={stats?.series?.requests ?? []}
                  errors={stats?.series?.errors ?? []}
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
