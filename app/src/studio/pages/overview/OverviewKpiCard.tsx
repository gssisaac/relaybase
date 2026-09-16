"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** Top KPI tiles — lifted from page canvas with clear type hierarchy. */
export const overviewKpiClassName =
  "block rounded-xl bg-card px-4 py-4 shadow-sm ring-1 ring-border transition-colors hover:bg-secondary/50 dark:hover:bg-accent/55";

export function formatOverviewCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

export function OverviewKpiCard({
  href,
  onClick,
  selected,
  icon: Icon,
  label,
  value,
  hint,
}: {
  href?: string;
  onClick?: () => void;
  selected?: boolean;
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
}) {
  const tileClassName = cn(
    overviewKpiClassName,
    onClick && "cursor-pointer text-left",
    selected && "bg-secondary/50 ring-2 ring-primary dark:bg-accent/55",
  );

  const inner = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-3xl font-bold tabular-nums leading-none tracking-tight text-foreground">{value}</p>
        <p className="text-xs leading-snug text-muted-foreground">{hint}</p>
      </div>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary/80 text-muted-foreground dark:bg-accent">
        <Icon className="size-4" aria-hidden />
      </span>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className={tileClassName}>
        {inner}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(tileClassName, "w-full")}
        aria-pressed={selected}
      >
        {inner}
      </button>
    );
  }

  return <div className={tileClassName}>{inner}</div>;
}
