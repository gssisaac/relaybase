"use client";

import { Activity, FilePen, Pause, Zap } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TriggerStatus, ScaleOverview } from "@/lib/scale/api";
import { triggersStatsHref } from "@/scale/lib/paths";
import { OverviewKpiCard } from "@/scale/pages/overview/OverviewKpiCard";
import { ScaleOverviewTriggersChart } from "@/scale/pages/overview/ScaleOverviewCharts";

export function TriggersOverviewTopSection({
  data,
  filter,
  onFilterChange,
}: {
  data: ScaleOverview;
  filter: "all" | TriggerStatus;
  onFilterChange: (filter: "all" | TriggerStatus) => void;
}) {
  const summary = data.triggers;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <OverviewKpiCard
          icon={Zap}
          label="Active"
          value={String(summary.activeCount)}
          hint={`${summary.triggers24h} triggers in the last 24h`}
          selected={filter === "active"}
          onClick={() => onFilterChange("active")}
        />
        <OverviewKpiCard
          icon={Pause}
          label="Paused"
          value={String(summary.pausedCount)}
          hint={`${summary.totalCount} triggers total`}
          selected={filter === "paused"}
          onClick={() => onFilterChange("paused")}
        />
        <OverviewKpiCard
          icon={FilePen}
          label="Draft"
          value={String(summary.draftCount)}
          hint="Not live until activated"
          selected={filter === "draft"}
          onClick={() => onFilterChange("draft")}
        />
        <OverviewKpiCard
          href={triggersStatsHref()}
          icon={Activity}
          label="Triggers (24h)"
          value={String(summary.triggers24h)}
          hint="Fires across all triggers · view stats"
        />
      </div>

      <Card size="sm">
        <CardHeader className="gap-0.5 pb-1">
          <CardTitle className="text-sm">Trigger volume</CardTitle>
          <CardDescription className="text-xs">Last 7 days</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <ScaleOverviewTriggersChart data={data.charts.automationTriggersByDay} />
        </CardContent>
      </Card>
    </>
  );
}
