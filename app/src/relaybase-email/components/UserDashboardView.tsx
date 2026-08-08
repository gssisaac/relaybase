"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { SparklineChart } from "@/components/dashboard/SparklineChart";
import { useDomain } from "@/lib/dashboard/DomainContext";
import { useEmailPaths } from "@/relaybase-email/components/useEmailPaths";
import { CurrentDomainSelect } from "@/relaybase-email/components/CurrentDomainSelect";
import { EmailAlerts } from "@/relaybase-email/components/EmailShared";
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

const WORKSPACE_CARDS = [
  {
    key: "addresses" as const,
    label: "Senders",
    description: "Registered addresses",
    href: "accounts",
    color: "#38bdf8",
  },
  {
    key: "audience" as const,
    label: "Audience",
    description: "Contacts for broadcasts",
    href: "audience",
    color: "#a78bfa",
  },
  {
    key: "broadcasts" as const,
    label: "Broadcasts",
    description: "Campaigns on this domain",
    href: "broadcasts",
    color: "#f59e0b",
  },
  {
    key: "sent" as const,
    label: "Sent",
    description: "Outbound messages",
    href: "emails/inbox",
    color: "#22c55e",
    seriesKey: "sent" as const,
  },
];

const API_CARDS = [
  {
    key: "apiKeys" as const,
    label: "API keys",
    description: "Keys issued for this domain",
    href: "keys",
    color: "#a78bfa",
    seriesKey: "apiKeysUsed" as const,
  },
  {
    key: "requests" as const,
    label: "Requests",
    description: "Send API calls in range",
    href: "keys",
    color: "#22c55e",
    seriesKey: "requests" as const,
  },
  {
    key: "errors" as const,
    label: "Errors",
    description: "Failed sends in range",
    href: "keys",
    color: "#ef4444",
    seriesKey: "errors" as const,
  },
  {
    key: "apiEmails" as const,
    label: "API emails",
    description: "Successful sends via API",
    href: "keys",
    color: "#34d399",
    seriesKey: "apiEmails" as const,
  },
];

export function UserDashboardView() {
  const { domainQuery, activeDomain, domains } = useDomain();
  const { base } = useEmailPaths();
  const [range, setRange] = useState<StatsRange>("7d");
  const [stats, setStats] = useState<UserStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (nextRange: StatsRange, force?: boolean) => {
      if (force) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/email/stats${domainQuery({ range: nextRange })}`,
          { cache: "no-store" },
        );
        const data = (await res.json()) as UserStatsResponse & { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Failed to load stats");
        setStats(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load stats");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [domainQuery],
  );

  useEffect(() => {
    void load(range);
  }, [load, range, activeDomain]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview for your email workspace
            {activeDomain ? (
              <>
                {" "}
                on <span className="font-mono">{activeDomain}</span>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CurrentDomainSelect />
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load(range, true)}
            disabled={refreshing}
          >
            <RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} />
          </Button>
        </div>
      </div>

      <EmailAlerts error={error} message={null} />

      {!domains.length && !loading ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Get started</CardTitle>
            <CardDescription>
              Add your first sending domain to unlock accounts, email, broadcasts,
              and audience tools.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="sm" nativeButton={false} render={<Link href={`${base}/domains`} />}>
              Add domain
            </Button>
          </CardContent>
        </Card>
      ) : null}

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
          <Badge variant={stats.workerConnected ? "default" : "secondary"}>
            {stats.workerConnected ? "Worker connected" : "Worker offline"}
          </Badge>
        ) : null}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Workspace
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {WORKSPACE_CARDS.map((card) => {
            const value = stats?.totals[card.key] ?? 0;
            const series =
              "seriesKey" in card && card.seriesKey
                ? (stats?.series[card.seriesKey]?.map((b) => b.value) ?? [])
                : [];
            const body = (
              <>
                <CardHeader className="pb-2">
                  <CardDescription>{card.description}</CardDescription>
                  <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <SparklineChart
                    data={series}
                    color={card.color}
                    className="h-16"
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{card.label}</span>
                    {card.key === "broadcasts" && stats ? (
                      <Badge variant="secondary">{stats.totals.drafts} drafts</Badge>
                    ) : null}
                  </div>
                </CardContent>
              </>
            );

            return (
              <Card
                key={card.key}
                className={cn(card.href && "transition-colors hover:bg-accent/30")}
              >
                <Link href={`${base}/${card.href}`} className="block">
                  {body}
                </Link>
              </Card>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          API activity
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {API_CARDS.map((card) => {
            const value = stats?.totals[card.key] ?? 0;
            const series =
              stats?.series[card.seriesKey]?.map((b) => b.value) ?? [];
            return (
              <Card
                key={card.key}
                className="transition-colors hover:bg-accent/30"
              >
                <Link href={`${base}/${card.href}`} className="block">
                  <CardHeader className="pb-2">
                    <CardDescription>{card.description}</CardDescription>
                    <CardTitle
                      className={cn(
                        "text-2xl tabular-nums",
                        card.key === "errors" && value > 0 && "text-destructive",
                      )}
                    >
                      {value.toLocaleString()}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <SparklineChart
                      data={series}
                      color={card.color}
                      className="h-16"
                    />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{card.label}</span>
                      {card.key === "apiKeys" && stats ? (
                        <Badge variant="secondary">
                          {stats.totals.apiKeysUsed} used
                        </Badge>
                      ) : null}
                    </div>
                  </CardContent>
                </Link>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
