"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ScheduleItemPopover } from "@/scale/components/ScheduleItemPopover";
import {
  dateKeyLocal,
  isSameLocalDay,
  scheduleItemsByDayKey,
  type ScheduleItem,
} from "@/scale/lib/schedule-items";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MAX_EVENTS_SHOWN = 4;

function monthStart(year: number, month: number): Date {
  return new Date(year, month, 1);
}

function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function ScheduleMonthCalendar({
  viewYear,
  viewMonth,
  onViewMonthChange,
  items,
  className,
}: {
  viewYear: number;
  viewMonth: number;
  onViewMonthChange: (year: number, month: number) => void;
  items: ScheduleItem[];
  className?: string;
}) {
  const itemsByDay = useMemo(() => scheduleItemsByDayKey(items), [items]);

  const monthLabel = useMemo(
    () =>
      monthStart(viewYear, viewMonth).toLocaleString(undefined, {
        month: "long",
        year: "numeric",
      }),
    [viewYear, viewMonth],
  );

  const cells = useMemo(() => {
    const first = monthStart(viewYear, viewMonth);
    const startOffset = first.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
    const today = new Date();

    const out: Array<{
      date: Date;
      inMonth: boolean;
      key: string;
      isToday: boolean;
      dayEvents: ScheduleItem[];
    }> = [];

    for (let i = 0; i < totalCells; i++) {
      const dayIndex = i - startOffset + 1;
      const date = new Date(viewYear, viewMonth, dayIndex);
      const inMonth = dayIndex >= 1 && dayIndex <= daysInMonth;
      const key = dateKeyLocal(date);
      out.push({
        date,
        inMonth,
        key,
        isToday: isSameLocalDay(date, today),
        dayEvents: itemsByDay.get(key) ?? [],
      });
    }
    return out;
  }, [viewYear, viewMonth, itemsByDay]);

  function shiftMonth(delta: number) {
    const next = addMonths(viewYear, viewMonth, delta);
    onViewMonthChange(next.year, next.month);
  }

  return (
    <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col", className)}>
      <div className="mb-2 flex shrink-0 items-center justify-between gap-2 px-0.5">
        <Button type="button" variant="outline" size="icon-sm" onClick={() => shiftMonth(-1)}>
          <ChevronLeft className="size-4" aria-hidden />
          <span className="sr-only">Previous month</span>
        </Button>
        <p className="text-sm font-semibold tabular-nums">{monthLabel}</p>
        <Button type="button" variant="outline" size="icon-sm" onClick={() => shiftMonth(1)}>
          <ChevronRight className="size-4" aria-hidden />
          <span className="sr-only">Next month</span>
        </Button>
      </div>

      <div className="grid shrink-0 grid-cols-7 border border-border/80 bg-muted/30">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="border-b border-r border-border/80 py-1.5 text-center text-[11px] font-medium text-muted-foreground nth-[7n]:border-r-0"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6 border-x border-b border-border/80">
        {cells.map((cell) => {
          const dayNum = cell.date.getDate();
          const shown = cell.dayEvents.slice(0, MAX_EVENTS_SHOWN);
          const overflow = cell.dayEvents.length - shown.length;

          return (
            <div
              key={cell.key}
              className={cn(
                "flex min-h-0 min-w-0 flex-col border-b border-r border-border/80 p-1 nth-[7n]:border-r-0",
                !cell.inMonth && "bg-muted/25",
                cell.inMonth && "bg-card",
              )}
            >
              <div className="flex shrink-0 justify-end">
                <span
                  className={cn(
                    "inline-flex size-6 items-center justify-center text-xs tabular-nums",
                    !cell.inMonth && "text-muted-foreground/70",
                    cell.isToday &&
                      "rounded-full bg-primary font-semibold text-primary-foreground",
                  )}
                >
                  {dayNum}
                </span>
              </div>

              <div className="mt-0.5 flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
                {shown.map((item) => (
                  <ScheduleItemPopover key={item.id} item={item} variant="calendar" />
                ))}
                {overflow > 0 ? (
                  <p className="truncate px-0.5 text-[10px] text-muted-foreground">
                    +{overflow} more
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
