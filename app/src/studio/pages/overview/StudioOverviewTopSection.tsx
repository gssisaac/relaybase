"use client";

import { CalendarClock, LayoutTemplate, Mail, Users, Zap } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { StudioOverview } from "@/studio/api";

import { formatOverviewCompact, OverviewKpiCard } from "./OverviewKpiCard";
import {
  StudioOverviewSubscriberHealthChart,
  StudioOverviewEngagementChart,
  StudioOverviewSendsChart,
  StudioOverviewTriggersChart,
} from "./StudioOverviewCharts";

type StudioOverviewPaths = {
  schedule: string;
  templates: string;
  triggers: string;
  newsletters: string;
  subscribers: string;
  templateCount: number;
};

export function StudioOverviewTopSection({
  data,
  paths,
}: {
  data: StudioOverview;
  paths: StudioOverviewPaths;
}) {
  const { summary } = data;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <OverviewKpiCard
          href={paths.templates}
          icon={LayoutTemplate}
          label="Templates"
          value={String(paths.templateCount)}
          hint="Reusable message content"
        />
        <OverviewKpiCard
          href={paths.triggers}
          icon={Zap}
          label="Triggers"
          value={String(summary.activeTriggers)}
          hint={`${data.triggers.triggers24h} triggers in the last 24h`}
        />
        <OverviewKpiCard
          href={paths.newsletters}
          icon={Mail}
          label="Newsletters"
          value={formatOverviewCompact(summary.monthlySentVolume)}
          hint={`${summary.avgOpenRate}% open · ${summary.avgClickRate}% click (all time)`}
        />
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
          href={paths.subscribers}
          icon={Users}
          label="Subscribers"
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
            <StudioOverviewSendsChart data={data.charts.sendsByWeek} />
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader className="gap-0.5 pb-1">
            <CardTitle className="text-sm">Engagement rates</CardTitle>
            <CardDescription className="text-xs">All sent newsletters</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <StudioOverviewEngagementChart data={data.charts.engagementRates} />
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader className="gap-0.5 pb-1">
            <CardTitle className="text-sm">Trigger volume</CardTitle>
            <CardDescription className="text-xs">Last 7 days</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <StudioOverviewTriggersChart data={data.charts.automationTriggersByDay} />
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader className="gap-0.5 pb-1">
            <CardTitle className="text-sm">Subscriber health</CardTitle>
            <CardDescription className="text-xs">Active, unsubscribed, bounced</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <StudioOverviewSubscriberHealthChart data={data.charts.subscriberHealth} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
