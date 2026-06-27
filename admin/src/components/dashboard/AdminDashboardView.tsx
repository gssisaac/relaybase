"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { EMAIL_SENDER_API } from "@/relaybase/components/constants";
import type { StatsRange } from "@/lib/admin/stats";

type AdminStatsResponse = {
  range: StatsRange;
  workerConnected: boolean;
  totals: {
    users: number;
    authTokens: number;
    apiKeysIssued: number;
    apiKeysUsed: number;
    requests: number;
    errors: number;
    emails: number;
  };
  series: {
    users: { value: number }[];
    authTokens: { value: number }[];
    apiKeysUsed: { value: number }[];
    requests: { value: number }[];
    errors: { value: number }[];
    emails: { value: number }[];
  };
};

const RANGE_OPTIONS: { value: StatsRange; label: string }[] = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "1 month" },
  { value: "90d", label: "3 months" },
];

type StatCard = {
  key: keyof AdminStatsResponse["totals"];
  label: string;
  description: string;
  seriesKey: keyof AdminStatsResponse["series"];
  color: string;
  href?: string;
  format?: (value: number) => string;
};

const STAT_CARDS: StatCard[] = [
  {
    key: "users",
    label: "Users",
    description: "Registered accounts",
    seriesKey: "users",
    color: "#22c55e",
    href: "/users",
  },
  {
    key: "authTokens",
    label: "Auth tokens",
    description: "Dashboard tokens issued",
    seriesKey: "authTokens",
    color: "#38bdf8",
  },
  {
    key: "apiKeysUsed",
    label: "API keys used",
    description: "Distinct keys with activity",
    seriesKey: "apiKeysUsed",
    color: "#a78bfa",
    href: "/keys",
    format: (value) => String(value),
  },
  {
    key: "requests",
    label: "Requests",
    description: "Send API calls in range",
    seriesKey: "requests",
    color: "#22c55e",
    href: "/logs",
  },
  {
    key: "errors",
    label: "Errors",
    description: "Failed sends in range",
    seriesKey: "errors",
    color: "#ef4444",
    href: "/logs",
  },
  {
    key: "emails",
    label: "Emails",
    description: "Successful sends in range",
    seriesKey: "emails",
    color: "#34d399",
    href: "/email",
  },
];

export function AdminDashboardView() {
  const [range, setRange] = useState<StatsRange>("7d");
  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextRange: StatsRange, force?: boolean) => {
    if (force) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const res = await fetch(
        `${EMAIL_SENDER_API}/stats?range=${nextRange}`,
        { cache: "no-store" },
      );
      const data = (await res.json()) as AdminStatsResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load stats");
      setStats(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load stats");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(range);
  }, [range, load]);

  const displayValue = (card: StatCard) => {
    if (!stats) return "—";
    const value = stats.totals[card.key];
    if (card.key === "apiKeysUsed" && stats.totals.apiKeysIssued > 0) {
      return `${value} / ${stats.totals.apiKeysIssued}`;
    }
    return card.format ? card.format(value) : value.toLocaleString();
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Platform overview for Relaybase — users, tokens, API traffic, and email
            volume.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {stats ? (
            <Badge variant={stats.workerConnected ? "default" : "secondary"}>
              {stats.workerConnected ? "Worker connected" : "Worker offline"}
            </Badge>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            disabled={refreshing}
            onClick={() => void load(range, true)}
          >
            <RefreshCw
              className={cn("size-4", refreshing && "animate-spin")}
            />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border border-border/60 bg-muted/30 p-1">
        {RANGE_OPTIONS.map((option) => (
          <Button
            key={option.value}
            size="sm"
            variant={range === option.value ? "default" : "ghost"}
            className="h-8"
            onClick={() => setRange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      {loading && !stats ? (
        <p className="text-sm text-muted-foreground">Loading dashboard…</p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {STAT_CARDS.map((card) => {
          const series = stats?.series[card.seriesKey].map((b) => b.value) ?? [];
          const content = (
            <Card className="overflow-hidden">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">{card.label}</CardDescription>
                <CardTitle
                  className={cn(
                    "text-2xl font-semibold tabular-nums",
                    card.key === "errors" &&
                      (stats?.totals.errors ?? 0) > 0 &&
                      "text-destructive",
                  )}
                >
                  {displayValue(card)}
                </CardTitle>
                <p className="text-xs text-muted-foreground">{card.description}</p>
              </CardHeader>
              <CardContent className="pt-0">
                <SparklineChart
                  data={series}
                  color={card.color}
                  className="h-16"
                />
              </CardContent>
            </Card>
          );

          if (card.href) {
            return (
              <Link
                key={card.key}
                href={card.href}
                className="block transition-opacity hover:opacity-90"
              >
                {content}
              </Link>
            );
          }

          return <div key={card.key}>{content}</div>;
        })}
      </div>

      {stats && !stats.workerConnected ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Worker not connected</CardTitle>
            <CardDescription>
              Requests, errors, and email metrics require a linked Relaybase worker.
              User and auth token counts are still tracked locally.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="sm" variant="outline" render={<Link href="/settings" />}>
              Open settings
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
