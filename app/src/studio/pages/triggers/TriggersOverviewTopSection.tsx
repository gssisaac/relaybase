"use client";

import { Activity, FilePen, Pause, Zap } from "lucide-react";

import type { TriggerStatus, StudioAnalytics } from "@/studio/api";
import { triggersStatsHref } from "@/studio/lib/paths";
import { OverviewKpiCard } from "@/studio/pages/overview/OverviewKpiCard";

export function TriggersOverviewTopSection({
  data,
  filter,
  onFilterChange,
}: {
  data: StudioAnalytics;
  filter: "all" | TriggerStatus;
  onFilterChange: (filter: "all" | TriggerStatus) => void;
}) {
  const summary = data.triggers;

  return (
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
  );
}
