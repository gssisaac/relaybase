"use client";

import Link from "next/link";

import { useBroadcastDetail } from "@/dashboard/components/BroadcastDetailContext";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function BroadcastAudienceView() {
  const { detail, loading } = useBroadcastDetail();

  if (loading && !detail) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (!detail) return null;

  const { groups, recipientCount } = detail;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Audience</CardTitle>
        <CardDescription>
          {recipientCount.toLocaleString()} unique recipient
          {recipientCount === 1 ? "" : "s"} across {groups.length} group
          {groups.length === 1 ? "" : "s"}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {groups.length > 0 ? (
          <ul className="divide-y divide-border">
            {groups.map((group) => (
              <li
                key={group.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <Link
                    href={`/audience/${encodeURIComponent(group.id)}`}
                    className="font-medium hover:underline"
                  >
                    {group.name}
                  </Link>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    {group.domain}
                  </p>
                </div>
                <Badge variant="secondary" className="text-[10px] tabular-nums">
                  {group.contactCount} contacts
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No audience groups.</p>
        )}
      </CardContent>
    </Card>
  );
}
