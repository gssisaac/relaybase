"use client";

import { useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { scaleApi, type AutomationStats } from "@/lib/scale/api";
import { AutomationActivitySections } from "@/scale/pages/automations/AutomationActivityView";
import { useAutomationDetail } from "@/scale/pages/automations/AutomationDetailContext";

function rate(part: number, total: number): string {
  if (!total) return "0%";
  return `${((part / total) * 100).toFixed(1)}%`;
}

export function AutomationStatsView() {
  const { automationId, automation } = useAutomationDetail();
  const [stats, setStats] = useState<AutomationStats | null>(automation?.stats ?? null);

  useEffect(() => {
    scaleApi.getAutomationStats(automationId).then((res) => {
      setStats(res.stats);
    });
  }, [automationId]);

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

      <AutomationActivitySections automationId={automationId} />
    </div>
  );
}
