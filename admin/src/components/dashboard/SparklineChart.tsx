"use client";

import { useId, useMemo } from "react";

import { cn } from "@/lib/utils";

type SparklineChartProps = {
  data: number[];
  className?: string;
  /** Line color — defaults to green */
  color?: string;
  height?: number;
};

export function SparklineChart({
  data,
  className,
  color = "#22c55e",
  height = 64,
}: SparklineChartProps) {
  const gradientId = useId().replace(/:/g, "");

  const { linePath, areaPath, hasData } = useMemo(() => {
    const width = 100;
    const padding = 2;
    const innerH = height - padding * 2;

    if (!data.length) {
      return { linePath: "", areaPath: "", hasData: false };
    }

    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const span = max - min || 1;

    const points = data.map((value, index) => {
      const x =
        data.length === 1
          ? width / 2
          : (index / (data.length - 1)) * width;
      const normalized = (value - min) / span;
      const y = padding + innerH - normalized * innerH;
      return { x, y };
    });

    const linePath = points
      .map((point, index) =>
        index === 0
          ? `M ${point.x} ${point.y}`
          : `L ${point.x} ${point.y}`,
      )
      .join(" ");

    const areaPath = `${linePath} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

    return { linePath, areaPath, hasData: data.some((v) => v > 0) };
  }, [data, height]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-border/60 bg-black/40",
        className,
      )}
    >
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="block h-full w-full"
        aria-hidden
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {hasData && areaPath ? (
          <path d={areaPath} fill={`url(#${gradientId})`} />
        ) : null}
        {hasData && linePath ? (
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        ) : (
          <line
            x1="0"
            y1={height / 2}
            x2="100"
            y2={height / 2}
            stroke="currentColor"
            strokeOpacity={0.15}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
    </div>
  );
}
