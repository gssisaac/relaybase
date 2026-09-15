"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { ScaleOverview } from "@/lib/scale/api";

const sendsChartConfig = {
  sent: { label: "Sent", color: "var(--chart-1)" },
  opened: { label: "Opened", color: "var(--chart-2)" },
  clicked: { label: "Clicked", color: "var(--chart-3)" },
} satisfies ChartConfig;

const audienceChartConfig = {
  active: { label: "Active", color: "var(--chart-1)" },
  unsubscribed: { label: "Unsubscribed", color: "var(--chart-4)" },
  bounced: { label: "Bounced", color: "var(--chart-5)" },
} satisfies ChartConfig;

const triggersChartConfig = {
  count: { label: "Triggers", color: "var(--chart-2)" },
} satisfies ChartConfig;

const engagementChartConfig = {
  value: { label: "Rate", color: "var(--chart-1)" },
  delivery: { label: "Delivery", color: "var(--chart-1)" },
  open: { label: "Open", color: "var(--chart-2)" },
  click: { label: "Click", color: "var(--chart-3)" },
} satisfies ChartConfig;

export function ScaleOverviewSendsChart({ data }: { data: ScaleOverview["charts"]["sendsByWeek"] }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No sent broadcasts yet — volume appears after your first send.</p>;
  }

  return (
    <ChartContainer config={sendsChartConfig} className="aspect-auto h-[220px] w-full">
      <BarChart accessibilityLayer data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="sent" fill="var(--color-sent)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="opened" fill="var(--color-opened)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="clicked" fill="var(--color-clicked)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

export function ScaleOverviewAudienceChart({ data }: { data: ScaleOverview["charts"]["audienceHealth"] }) {
  const chartData = data.map((row) => ({
    label: row.label,
    count: row.count,
    fill: `var(--color-${row.key === "active" ? "active" : row.key === "unsubscribed" ? "unsubscribed" : "bounced"})`,
  }));

  if (chartData.every((row) => row.count === 0)) {
    return <p className="text-sm text-muted-foreground">Add audience groups to see contact health.</p>;
  }

  return (
    <ChartContainer config={audienceChartConfig} className="aspect-auto h-[200px] w-full">
      <BarChart accessibilityLayer data={chartData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

export function ScaleOverviewTriggersChart({
  data,
}: {
  data: ScaleOverview["charts"]["automationTriggersByDay"];
}) {
  return (
    <ChartContainer config={triggersChartConfig} className="aspect-auto h-[200px] w-full">
      <BarChart accessibilityLayer data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval="preserveStartEnd" />
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

export function ScaleOverviewEngagementChart({
  data,
}: {
  data: ScaleOverview["charts"]["engagementRates"];
}) {
  const chartData = data.map((row) => ({
    label: row.label,
    value: row.value,
    fill: `var(--color-${row.key})`,
  }));

  return (
    <ChartContainer config={engagementChartConfig} className="aspect-auto h-[200px] w-full">
      <BarChart accessibilityLayer data={chartData} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 0 }}>
        <CartesianGrid horizontal={false} />
        <YAxis dataKey="label" type="category" tickLine={false} axisLine={false} width={72} />
        <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
        <ChartTooltip content={<ChartTooltipContent formatter={(value) => `${value}%`} />} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
