"use client";

import { useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { scaleApi, type TriggerStats } from "@/lib/scale/api";
import { TriggerActivitySections } from "@/scale/pages/triggers/TriggerActivityView";
import { useTriggerDetail } from "@/scale/pages/triggers/TriggerDetailContext";

function rate(part: number, total: number): string {
  if (!total) return "0%";
  return `${((part / total) * 100).toFixed(1)}%`;
}

export function TriggerStatsView() {
  const { triggerId, trigger } = useTriggerDetail();
  const [stats, setStats] = useState<TriggerStats | null>(trigger?.stats ?? null);

  useEffect(() => {
    scaleApi.getTriggerStats(triggerId).then((res) => {
      setStats(res.stats);
    });
  }, [triggerId]);

  const deliveryBase = stats ? stats.delivered || stats.sent : 0;

  return (
    <div className="space-y-8 p-4">
      {!stats ? (
        <p className="text-sm text-muted-foreground">Loading stats…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Triggers</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-semibold tabular-nums">
          {stats.triggered}
          <p className="mt-1 text-xs font-normal text-muted-foreground">
            {stats.matched} matched · {stats.deduped} deduped · {stats.skipped} skipped
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Delivered</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-semibold tabular-nums">
          {stats.delivered}
          <p className="mt-1 text-xs font-normal text-muted-foreground">
            {stats.failed} failed · {stats.bounced} bounced
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Engagement</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-semibold tabular-nums">
          {stats.opened}
          <p className="mt-1 text-xs font-normal text-muted-foreground">
            Open {rate(stats.opened, deliveryBase)} · Click {rate(stats.clicked, deliveryBase)}
          </p>
        </CardContent>
      </Card>
        </div>
      )}

      <TriggerActivitySections triggerId={triggerId} />
    </div>
  );
}
