"use client";

import { useBroadcastDetail } from "@/dashboard/components/BroadcastDetailContext";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function BroadcastContentView() {
  const { detail, loading } = useBroadcastDetail();

  if (loading && !detail) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (!detail) return null;

  const { broadcast } = detail;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Content</CardTitle>
        <CardDescription>
          From {broadcast.from || "—"} ·{" "}
          {broadcast.subject?.trim() || "Untitled"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <pre className="whitespace-pre-wrap text-sm leading-relaxed">
          {broadcast.body?.trim() ? broadcast.body : "(empty body)"}
        </pre>
      </CardContent>
    </Card>
  );
}
