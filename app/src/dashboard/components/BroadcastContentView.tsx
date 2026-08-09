"use client";

import { Megaphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useBroadcastDetail } from "@/dashboard/components/BroadcastDetailContext";
import { useDashboardPaths } from "@/dashboard/paths";
import { useEmailPaths } from "@/email/paths";
import { EmailAlerts } from "@/email/components/EmailShared";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function BroadcastContentView() {
  const { detail, loading } = useBroadcastDetail();
  const { apiBase } = useEmailPaths();
  const { broadcasts: broadcastsHref } = useDashboardPaths();
  const router = useRouter();

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading && !detail) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (!detail) return null;

  const { broadcast } = detail;

  async function useThisToBroadcast() {
    if (broadcast.groupIds.length === 0) {
      setError("This broadcast has no audience groups to reuse.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/broadcasts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupIds: broadcast.groupIds,
          from: broadcast.from,
          subject: broadcast.subject,
          text: broadcast.body,
          status: "draft",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create broadcast");
      router.push(
        `${broadcastsHref}/${encodeURIComponent(data.broadcast.id)}`,
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to create broadcast",
      );
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Content</h2>
          <p className="text-xs text-muted-foreground">
            From {broadcast.from || "—"} ·{" "}
            {broadcast.subject?.trim() || "Untitled"}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => void useThisToBroadcast()}
          disabled={creating}
        >
          <Megaphone className="size-4" />
          {creating ? "Creating…" : "Use this to broadcast"}
        </Button>
      </div>

      <EmailAlerts
        error={error}
        message={null}
        onDismissError={() => setError(null)}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Body</CardTitle>
          <CardDescription>
            Reuse this subject and body for a new draft broadcast.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="whitespace-pre-wrap text-sm leading-relaxed">
            {broadcast.body?.trim() ? broadcast.body : "(empty body)"}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
