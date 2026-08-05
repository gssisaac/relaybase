"use client";

import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { SparklineChart } from "@/components/dashboard/SparklineChart";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmailAlerts } from "@/relaybase-email/components/EmailShared";
import { accountMailboxNav } from "@/relaybase-email/components/MailboxNavContext";
import { useEmailPaths } from "@/relaybase-email/components/useEmailPaths";

type StatsRange = "24h" | "7d" | "30d";

type AccountStats = {
  email: string;
  displayName: string | null;
  domain: string;
  range: StatsRange;
  totals: {
    received: number;
    sent: number;
    apiRequests: number;
    apiEmails: number;
    apiErrors: number;
  };
  series: {
    received: { value: number; label: string }[];
    sent: { value: number; label: string }[];
    apiEmails: { value: number; label: string }[];
    apiErrors: { value: number; label: string }[];
  };
};

const RANGE_OPTIONS: { value: StatsRange; label: string }[] = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
];

export function AccountOverviewView({ email }: { email: string }) {
  const { apiBase } = useEmailPaths();
  const nav = accountMailboxNav(email);
  const [range, setRange] = useState<StatsRange>("7d");
  const [stats, setStats] = useState<AccountStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const params = new URLSearchParams({ email, range });
      const res = await fetch(`${apiBase}/account-stats?${params}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load stats");
      setStats(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load stats");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apiBase, email, range]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  const cards = [
    {
      label: "Received",
      description: "Inbound mail to this address",
      value: stats?.totals.received ?? 0,
      series: stats?.series.received,
      color: "#38bdf8",
      href: nav.inbox,
    },
    {
      label: "Sent",
      description: "Messages sent from the dashboard",
      value: stats?.totals.sent ?? 0,
      series: stats?.series.sent,
      color: "#22c55e",
      href: nav.sent,
    },
    {
      label: "API emails",
      description: "Successful API sends from this address",
      value: stats?.totals.apiEmails ?? 0,
      series: stats?.series.apiEmails,
      color: "#34d399",
      href: nav.sent,
    },
    {
      label: "API errors",
      description: "Failed API sends from this address",
      value: stats?.totals.apiErrors ?? 0,
      series: stats?.series.apiErrors,
      color: "#ef4444",
      href: nav.compose,
    },
  ];

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Overview</h2>
          <p className="text-xs text-muted-foreground">
            Send and receive activity for {email}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg bg-muted p-0.5">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setRange(option.value)}
                className={
                  range === option.value
                    ? "rounded-md bg-background px-2.5 py-1 text-xs font-medium shadow-sm"
                    : "rounded-md px-2.5 py-1 text-xs text-muted-foreground"
                }
              >
                {option.label}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={refreshing}
            onClick={() => void refresh()}
          >
            <RefreshCw
              className={refreshing ? "size-4 animate-spin" : "size-4"}
            />
          </Button>
        </div>
      </div>

      <EmailAlerts error={error} message={null} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className="block">
            <Card className="h-full transition-colors hover:bg-accent/30">
              <CardHeader className="pb-2">
                <CardDescription>{card.label}</CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {loading && !stats ? "—" : card.value}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {card.description}
                </p>
                {card.series ? (
                  <SparklineChart
                    data={card.series.map((point) => point.value)}
                    color={card.color}
                    className="h-10 w-full"
                  />
                ) : (
                  <div className="h-10" />
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {stats ? (
        <p className="text-xs text-muted-foreground">
          API requests in range:{" "}
          <span className="tabular-nums text-foreground">
            {stats.totals.apiRequests}
          </span>
          {" · "}
          Domain {stats.domain}
        </p>
      ) : null}
    </div>
  );
}
