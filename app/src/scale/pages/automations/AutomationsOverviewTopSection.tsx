"use client";

import { Activity, FilePen, Pause, Zap } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AutomationStatus, ScaleOverview } from "@/lib/scale/api";
import { automationsTriggerStatsHref } from "@/scale/lib/paths";
import { OverviewKpiCard } from "@/scale/pages/overview/OverviewKpiCard";
import { ScaleOverviewTriggersChart } from "@/scale/pages/overview/ScaleOverviewCharts";

export function AutomationsOverviewTopSection({
  data,
  filter,
  onFilterChange,
}: {
  data: ScaleOverview;
  filter: "all" | AutomationStatus;
  onFilterChange: (filter: "all" | AutomationStatus) => void;
}) {
  const { automations } = data;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <OverviewKpiCard
          icon={Zap}
          label="Active"
          value={String(automations.activeCount)}
          hint={`${automations.triggers24h} triggers in the last 24h`}
          selected={filter === "active"}
          onClick={() => onFilterChange("active")}
        />
        <OverviewKpiCard
          icon={Pause}
          label="Paused"
          value={String(automations.pausedCount)}
          hint={`${automations.totalCount} automations total`}
          selected={filter === "paused"}
          onClick={() => onFilterChange("paused")}
        />
        <OverviewKpiCard
          icon={FilePen}
          label="Draft"
          value={String(automations.draftCount)}
          hint="Not live until activated"
          selected={filter === "draft"}
          onClick={() => onFilterChange("draft")}
        />
        <OverviewKpiCard
          href={automationsTriggerStatsHref()}
          icon={Activity}
          label="Triggers (24h)"
          value={String(automations.triggers24h)}
          hint="Fires across all automations · view stats"
        />
      </div>

      <Card size="sm">
        <CardHeader className="gap-0.5 pb-1">
          <CardTitle className="text-sm">Automation triggers</CardTitle>
          <CardDescription className="text-xs">Last 7 days</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <ScaleOverviewTriggersChart data={data.charts.automationTriggersByDay} />
        </CardContent>
      </Card>
    </>
  );
}
