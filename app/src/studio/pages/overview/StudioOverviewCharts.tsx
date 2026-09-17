"use client";

import { Bar, BarChart, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { StudioAnalytics } from "@/studio/api";
import { cn } from "@/lib/utils";

/** Compact overview charts — minimal axes, short height, pill bars. */
const miniChartClassName = "aspect-auto h-[120px] w-full text-[10px] [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground";

const sendsChartConfig = {
  sent: { label: "Sent", color: "var(--chart-1)" },
  opened: { label: "Opened", color: "var(--chart-3)" },
  clicked: { label: "Clicked", color: "var(--chart-5)" },
} satisfies ChartConfig;

const subscriberHealthChartConfig = {
  count: { label: "Contacts", color: "var(--chart-2)" },
} satisfies ChartConfig;

const triggersChartConfig = {
  count: { label: "Triggers", color: "var(--chart-2)" },
} satisfies ChartConfig;

const engagementChartConfig = {
  value: { label: "Rate", color: "var(--chart-1)" },
} satisfies ChartConfig;

function MiniLegend({ config, keys }: { config: ChartConfig; keys: string[] }) {
  return (
    <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
      {keys.map((key) => (
        <span key={key} className="inline-flex items-center gap-1.5">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: (config[key] as { color?: string })?.color ?? "var(--chart-2)" }}
            aria-hidden
          />
          {(config[key] as { label?: string })?.label ?? key}
        </span>
      ))}
    </div>
  );
}

export function StudioOverviewSendsChart({ data }: { data: StudioAnalytics["charts"]["sendsByWeek"] }) {
  if (data.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">No sent newsletters yet — volume appears after your first send.</p>
    );
  }

  return (
    <div>
      <ChartContainer config={sendsChartConfig} className={miniChartClassName}>
        <BarChart
          accessibilityLayer
          data={data}
          margin={{ left: 0, right: 4, top: 4, bottom: 0 }}
          barGap={2}
          barCategoryGap="28%"
        >
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={6} interval="preserveStartEnd" />
          <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: "var(--accent)", opacity: 0.35 }} />
          <Bar dataKey="sent" fill="var(--color-sent)" radius={[6, 6, 6, 6]} maxBarSize={28} />
          <Bar dataKey="opened" fill="var(--color-opened)" radius={[6, 6, 6, 6]} maxBarSize={28} />
          <Bar dataKey="clicked" fill="var(--color-clicked)" radius={[6, 6, 6, 6]} maxBarSize={28} />
        </BarChart>
      </ChartContainer>
      <MiniLegend config={sendsChartConfig} keys={["sent", "opened", "clicked"]} />
    </div>
  );
}

export function StudioOverviewSubscriberHealthChart({ data }: { data: StudioAnalytics["charts"]["subscriberHealth"] }) {
  const chartData = data.map((row, index) => ({
    label: row.label,
    count: row.count,
    fill: `var(--chart-${index === 0 ? 1 : index === 1 ? 4 : 5})`,
  }));

  if (chartData.every((row) => row.count === 0)) {
    return <p className="text-xs text-muted-foreground">Add subscriber groups to see contact health.</p>;
  }

  return (
    <ChartContainer config={subscriberHealthChartConfig} className={miniChartClassName}>
      <BarChart
        accessibilityLayer
        data={chartData}
        margin={{ left: 0, right: 4, top: 4, bottom: 0 }}
        barCategoryGap="32%"
      >
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={6} />
        <ChartTooltip content={<ChartTooltipContent hideLabel />} cursor={{ fill: "var(--accent)", opacity: 0.35 }} />
        <Bar dataKey="count" radius={[6, 6, 6, 6]} maxBarSize={36} />
      </BarChart>
    </ChartContainer>
  );
}

export function StudioOverviewTriggersChart({
  data,
}: {
  data: StudioAnalytics["charts"]["automationTriggersByDay"];
}) {
  const labels = data.map((row) => {
    const parts = row.label.split(" ");
    return parts.length >= 2 ? parts.slice(0, 2).join(" ") : row.label;
  });
  const chartData = data.map((row, i) => ({ ...row, shortLabel: labels[i] ?? row.label }));

  return (
    <ChartContainer config={triggersChartConfig} className={miniChartClassName}>
      <BarChart
        accessibilityLayer
        data={chartData}
        margin={{ left: 0, right: 4, top: 4, bottom: 0 }}
        barCategoryGap="22%"
      >
        <XAxis dataKey="shortLabel" tickLine={false} axisLine={false} tickMargin={6} interval={0} />
        <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: "var(--accent)", opacity: 0.35 }} />
        <Bar dataKey="count" fill="var(--color-count)" radius={[6, 6, 6, 6]} maxBarSize={22} />
      </BarChart>
    </ChartContainer>
  );
}

export function StudioOverviewEngagementChart({
  data,
}: {
  data: StudioAnalytics["charts"]["engagementRates"];
}) {
  const chartData = data.map((row, index) => ({
    label: row.label,
    value: row.value,
    fill: `var(--chart-${index + 1})`,
  }));

  return (
    <ChartContainer config={engagementChartConfig} className={cn(miniChartClassName, "h-[100px]")}>
      <BarChart
        accessibilityLayer
        data={chartData}
        layout="vertical"
        margin={{ left: 0, right: 8, top: 0, bottom: 0 }}
        barCategoryGap="28%"
      >
        <YAxis
          dataKey="label"
          type="category"
          tickLine={false}
          axisLine={false}
          width={56}
          tick={{ fontSize: 10 }}
        />
        <XAxis type="number" domain={[0, 100]} hide />
        <ChartTooltip content={<ChartTooltipContent formatter={(value) => `${value}%`} hideLabel />} cursor={false} />
        <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={14} />
      </BarChart>
    </ChartContainer>
  );
}
