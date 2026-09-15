"use client";

import { CalendarClock, Mail, Users, Zap } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ScaleOverview } from "@/lib/scale/api";

import { formatOverviewCompact, OverviewKpiCard } from "./OverviewKpiCard";
import {
  ScaleOverviewAudienceChart,
  ScaleOverviewEngagementChart,
  ScaleOverviewSendsChart,
  ScaleOverviewTriggersChart,
} from "./ScaleOverviewCharts";

type ScaleOverviewPaths = {
  schedule: string;
  automations: string;
  broadcasts: string;
  audience: string;
};

export function ScaleOverviewTopSection({
  data,
  paths,
}: {
  data: ScaleOverview;
  paths: ScaleOverviewPaths;
}) {
  const { summary } = data;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <OverviewKpiCard
          href={paths.schedule}
          icon={CalendarClock}
          label="Schedule"
          value={String(summary.scheduledSends + summary.sendingNow)}
          hint={
            summary.sendingNow > 0
              ? `${summary.sendingNow} sending now · ${summary.scheduledSends} scheduled`
              : `${summary.scheduledSends} scheduled sends`
          }
        />
        <OverviewKpiCard
          href={paths.automations}
          icon={Zap}
          label="Automations"
          value={String(summary.activeAutomations)}
          hint={`${data.automations.triggers24h} triggers in the last 24h`}
        />
        <OverviewKpiCard
          href={paths.broadcasts}
          icon={Mail}
          label="Broadcasts"
          value={formatOverviewCompact(summary.monthlySentVolume)}
          hint={`${summary.avgOpenRate}% open · ${summary.avgClickRate}% click (all time)`}
        />
        <OverviewKpiCard
          href={paths.audience}
          icon={Users}
          label="Audience"
          value={formatOverviewCompact(summary.totalContacts)}
          hint={`${summary.deliverableRate}% deliverable contacts`}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card size="sm">
          <CardHeader className="gap-0.5 pb-1">
            <CardTitle className="text-sm">Send volume</CardTitle>
            <CardDescription className="text-xs">Weekly sent, opens, and clicks</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <ScaleOverviewSendsChart data={data.charts.sendsByWeek} />
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader className="gap-0.5 pb-1">
            <CardTitle className="text-sm">Engagement rates</CardTitle>
            <CardDescription className="text-xs">All sent broadcasts</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <ScaleOverviewEngagementChart data={data.charts.engagementRates} />
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader className="gap-0.5 pb-1">
            <CardTitle className="text-sm">Automation triggers</CardTitle>
            <CardDescription className="text-xs">Last 7 days</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <ScaleOverviewTriggersChart data={data.charts.automationTriggersByDay} />
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader className="gap-0.5 pb-1">
            <CardTitle className="text-sm">Audience health</CardTitle>
            <CardDescription className="text-xs">Active, unsubscribed, bounced</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <ScaleOverviewAudienceChart data={data.charts.audienceHealth} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
