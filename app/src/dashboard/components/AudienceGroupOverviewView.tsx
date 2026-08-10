"use client";

import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import { audienceDetailHref } from "@/dashboard/paths";
import { useEmailPaths } from "@/email/paths";
import {
  clearAudienceGroupDetailCache,
  useAudienceGroupDetail,
} from "@/dashboard/components/AudienceGroupDetailContext";
import { EmailAlerts } from "@/email/components/EmailShared";
import {
  desktopAwareFetch,
  friendlyDesktopFetchError,
  readResponseJson,
} from "@/lib/desktop/api-base";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function formatDateTime(value?: string): string {
  if (!value) return "Never";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AudienceGroupOverviewView() {
  const productId = useProductId();
  const { apiBase } = useEmailPaths();
  const { groupId, detail, loading, refresh } = useAudienceGroupDetail();
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (loading && !detail) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (!detail) return null;

  const { group, contacts } = detail;
  const manualCount = contacts.filter((c) => c.source === "manual").length;
  const syncedCount = contacts.filter((c) => c.source === "synced").length;

  async function refreshNow() {
    setSyncing(true);
    setError(null);
    setMessage(null);
    try {
      const res = await desktopAwareFetch(
        `${apiBase}/audience-groups/${encodeURIComponent(groupId)}/sync`,
        { method: "POST" },
      );
      const data = await readResponseJson<{
        ok?: boolean;
        error?: string;
        count?: number;
        skippedCount?: number;
      }>(res);
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      if (!data.ok) {
        setError(data.error ?? "Sync failed");
      } else {
        setMessage(
          `Synced ${data.count} contact${data.count === 1 ? "" : "s"}` +
            (data.skippedCount ? ` (${data.skippedCount} skipped)` : ""),
        );
      }
      clearAudienceGroupDetailCache(productId, groupId);
      await refresh(true);
    } catch (e) {
      setError(friendlyDesktopFetchError(e, "Sync failed"));
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-4">
      <EmailAlerts
        error={error}
        message={message}
        onDismissError={() => setError(null)}
        onDismissMessage={() => setMessage(null)}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-1">
            <CardDescription className="text-xs">Domain</CardDescription>
            <CardTitle className="font-mono text-lg font-semibold">
              {group.domain}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardDescription className="text-xs">Contacts</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {group.contactCount}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardDescription className="text-xs">Manual / Synced</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {manualCount} / {syncedCount}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardDescription className="text-xs">Scheduled refresh</CardDescription>
            <CardTitle className="text-lg font-semibold">
              {group.cronEnabled && group.cronIntervalMinutes
                ? `Every ${group.cronIntervalMinutes}m`
                : "Off"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-sm">Data source</CardTitle>
            <CardDescription>
              {group.dataSource
                ? "Generic JSON endpoint"
                : "No data source — contacts are added manually."}
            </CardDescription>
          </div>
          {group.dataSource ? (
            <Button
              variant="outline"
              size="sm"
              onClick={refreshNow}
              disabled={syncing}
            >
              <RefreshCw className={syncing ? "size-4 animate-spin" : "size-4"} />
              Refresh now
            </Button>
          ) : null}
        </CardHeader>
        {group.dataSource ? (
          <CardContent className="space-y-2 text-sm">
            <p className="truncate font-mono text-xs text-muted-foreground">
              {group.dataSource.endpointUrl}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={
                  group.lastSyncStatus === "error" ? "destructive" : "outline"
                }
                className="text-[10px]"
              >
                {group.lastSyncStatus === "error"
                  ? "Last sync failed"
                  : "Last sync ok"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatDateTime(group.lastSyncAt)}
              </span>
              {group.lastSyncCount != null ? (
                <span className="text-xs text-muted-foreground">
                  · {group.lastSyncCount} synced
                </span>
              ) : null}
            </div>
            {group.lastSyncStatus === "error" && group.lastSyncError ? (
              <p className="text-xs text-destructive">{group.lastSyncError}</p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Edit the endpoint, credential, or schedule in{" "}
              <Link
                href={audienceDetailHref(groupId, "settings")}
                className="underline"
              >
                Settings
              </Link>
              .
            </p>
          </CardContent>
        ) : (
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Add a data source in{" "}
              <Link
                href={audienceDetailHref(groupId, "settings")}
                className="underline"
              >
                Settings
              </Link>{" "}
              to sync contacts automatically.
            </p>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
