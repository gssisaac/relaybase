"use client";

import { useBroadcastDetail } from "@/console/pages/broadcasts/BroadcastDetailContext";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function formatWhen(value?: string): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function BroadcastOverviewView() {
  const { detail, loading } = useBroadcastDetail();

  if (loading && !detail) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (!detail) return null;

  const { broadcast, groups, recipientCount } = detail;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Overview</CardTitle>
          <CardDescription>
            Summary of this broadcast and who it targeted.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <Badge variant="default" className="mt-1 capitalize">
              {broadcast.status}
            </Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Recipients</p>
            <p className="mt-1 font-medium tabular-nums">
              {recipientCount.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">From</p>
            <p className="mt-1 font-mono text-sm">{broadcast.from || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Sent</p>
            <p className="mt-1">{formatWhen(broadcast.sentAt)}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs text-muted-foreground">Subject</p>
            <p className="mt-1 font-medium">
              {broadcast.subject?.trim() || "Untitled"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Audience groups</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-1.5">
          {groups.length > 0 ? (
            groups.map((g) => (
              <Badge key={g.id} variant="outline" className="text-[10px]">
                {g.name} · {g.domain}
              </Badge>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No groups linked.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
