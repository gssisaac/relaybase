"use client";

import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { SparklineChart } from "@/components/dashboard/SparklineChart";
import { UserLogsSection } from "@/components/users/UserLogsSection";
import { UserApiKeysSection } from "@/components/users/UserApiKeysSection";
import { UserAuthTokensSection } from "@/components/users/UserAuthTokensSection";
import { UserBrandingSection } from "@/components/users/UserBrandingSection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { StatsRange, UserDetail } from "@/lib/admin/user-profile";
import { cn } from "@/lib/utils";

const RANGE_OPTIONS: { value: StatsRange; label: string }[] = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "1 month" },
  { value: "90d", label: "3 months" },
];

const STAT_CARDS: {
  key: keyof UserDetail["stats"]["series"];
  totalKey: keyof UserDetail["stats"]["totals"];
  label: string;
  color: string;
}[] = [
  { key: "requests", totalKey: "requests", label: "Requests", color: "#22c55e" },
  { key: "errors", totalKey: "errors", label: "Errors", color: "#ef4444" },
  { key: "emails", totalKey: "emails", label: "Emails", color: "#34d399" },
  { key: "activity", totalKey: "signIns", label: "Sign-ins", color: "#38bdf8" },
];

export function UserDetailView({ userId }: { userId: string }) {
  const [range, setRange] = useState<StatsRange>("7d");
  const [user, setUser] = useState<UserDetail | null>(null);
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
          `/api/users/${encodeURIComponent(userId)}?range=${nextRange}`,
          { cache: "no-store" },
        );
        const data = (await res.json()) as UserDetail & { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Failed to load user");
        setUser(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load user");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    void load(range);
  }, [range, load]);

  if (loading && !user) {
    return (
      <div className="p-4">
        <p className="text-sm text-muted-foreground">Loading user…</p>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="space-y-4 p-4">
        <Button size="sm" variant="outline" render={<Link href="/users" />}>
          <ArrowLeft className="mr-1.5 size-3.5" />
          Back to users
        </Button>
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Button size="sm" variant="ghost" render={<Link href="/users" />}>
            <ArrowLeft className="mr-1.5 size-3.5" />
            Users
          </Button>
          <div>
            <h1 className="font-mono text-lg font-semibold">{user.id}</h1>
            <p className="text-sm text-muted-foreground">
              Created {new Date(user.createdAt).toLocaleString()} · Last seen{" "}
              {new Date(user.lastSeenAt).toLocaleString()}
              {user.domain ? (
                <>
                  {" "}
                  · Domain <span className="font-mono">{user.domain}</span>
                </>
              ) : null}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={user.workerConnected ? "default" : "secondary"}>
            {user.workerConnected ? "Worker connected" : "Worker offline"}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            disabled={refreshing}
            onClick={() => void load(range, true)}
          >
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant={user.emailData.relaybaseConfigured ? "default" : "secondary"}>
          Relaybase {user.emailData.relaybaseConfigured ? "connected" : "not connected"}
        </Badge>
        <Badge variant={user.emailData.cloudflareConfigured ? "default" : "secondary"}>
          Cloudflare {user.emailData.cloudflareConfigured ? "configured" : "missing"}
        </Badge>
        <Badge variant="outline">{user.authTokenCount} auth tokens</Badge>
        <Badge variant="outline">{user.apiKeyCount} API keys</Badge>
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STAT_CARDS.map((card) => {
          const series = user.stats.series[card.key].map((b) => b.value);
          const total = user.stats.totals[card.totalKey];
          return (
            <Card key={card.key} className="overflow-hidden">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">{card.label}</CardDescription>
                <CardTitle
                  className={cn(
                    "text-2xl font-semibold tabular-nums",
                    card.totalKey === "errors" && total > 0 && "text-destructive",
                  )}
                >
                  {total.toLocaleString()}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <SparklineChart data={series} color={card.color} className="h-16" />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Addresses", value: user.emailData.addressCount },
          { label: "Audience", value: user.emailData.audienceCount },
          { label: "Broadcasts", value: user.emailData.broadcastCount },
          { label: "Local sent", value: user.emailData.localSentCount },
        ].map((item) => (
          <Card key={item.label}>
            <CardHeader className="pb-1">
              <CardDescription className="text-xs">{item.label}</CardDescription>
              <CardTitle className="text-xl font-semibold tabular-nums">
                {item.value}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <UserLogsSection
        userId={user.id}
        workerConnected={user.workerConnected}
      />

      <UserAuthTokensSection
        userId={user.id}
        tokens={user.authTokens}
        onChange={() => void load(range, true)}
      />

      <UserApiKeysSection
        userId={user.id}
        domain={user.domain}
        keys={user.apiKeys}
        workerConnected={user.workerConnected}
        onChange={() => void load(range, true)}
      />

      <UserBrandingSection
        domain={user.domain}
        branding={user.brandingDetail}
        onRefresh={() => void load(range, true)}
      />
    </div>
  );
}
