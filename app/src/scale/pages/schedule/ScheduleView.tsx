"use client";

import Link from "next/link";
import { CalendarClock, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { Button } from "@/components/ui/button";
import { BroadcastStatusBadge } from "@/scale/components/BroadcastStatusBadge";
import { ScheduleMonthCalendar } from "@/scale/components/ScheduleMonthCalendar";
import { broadcastDetailHref } from "@/scale/lib/paths";
import {
  mergeBroadcastSnapshots,
  upcomingBroadcastScheduleItems,
  type ScheduleItem,
} from "@/scale/lib/schedule-items";
import { scaleApi } from "@/lib/scale/api";

function formatScheduleWhen(at: Date): string {
  return at.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatScheduleTime(at: Date): string {
  return at.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function ScheduleListRow({ item }: { item: ScheduleItem }) {
  return (
    <Link
      href={broadcastDetailHref(item.broadcastId, "publish", item.status)}
      className="block rounded-md border px-2.5 py-2 transition-colors hover:bg-muted/50"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="truncate text-sm font-medium">{item.title}</p>
          <p className="truncate text-xs text-muted-foreground">{item.subject}</p>
        </div>
        <div className="shrink-0 space-y-1 text-right">
          <BroadcastStatusBadge status={item.status} />
          <p className="text-xs tabular-nums text-muted-foreground">{formatScheduleTime(item.at)}</p>
        </div>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{formatScheduleWhen(item.at)}</p>
    </Link>
  );
}

export function ScheduleView() {
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const now = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(() => now.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => now.getMonth());

  const load = useCallback(async (force?: boolean) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    try {
      const [{ broadcasts }, overview] = await Promise.all([
        scaleApi.listBroadcasts(),
        scaleApi.getInProgressOverview(),
      ]);
      const merged = mergeBroadcastSnapshots(broadcasts, overview.scheduled);
      setItems(upcomingBroadcastScheduleItems(merged));
    } catch {
      toast.error("Could not load schedule — is hq/scale running on port 32831?");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(() => {
      void load(true);
    }, 60_000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <DesktopTitleBar
        className="shrink-0 px-4 py-3"
        end={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load(true)}
            disabled={refreshing}
          >
            <RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} />
          </Button>
        }
      >
        <div className="min-w-0 space-y-1">
          <h1 className="truncate text-lg font-semibold tracking-tight">Schedule</h1>
          <p className="text-sm text-muted-foreground">
            Upcoming sends — list on the left, month view on the right.
          </p>
        </div>
      </DesktopTitleBar>

      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden lg:flex-row">
        <section className="flex w-full shrink-0 flex-col border-b lg:w-72 lg:border-b-0 lg:border-r xl:w-80">
          <div className="shrink-0 border-b px-3 py-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Upcoming ({items.length})
            </p>
          </div>
          <div className="max-h-48 min-h-0 overflow-y-auto p-2 lg:max-h-none lg:flex-1">
            {loading && !items.length ? (
              <p className="p-2 text-sm text-muted-foreground">Loading…</p>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-2 py-8 text-center">
                <CalendarClock className="size-9 text-muted-foreground/60" aria-hidden />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Nothing scheduled yet</p>
                  <p className="text-xs text-muted-foreground">
                    Schedule a broadcast from Publish when you are ready to send.
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/scale/broadcasts">Open broadcasts</Link>
                </Button>
              </div>
            ) : (
              <ul className="space-y-1.5">
                {items.map((item) => (
                  <li key={item.id}>
                    <ScheduleListRow item={item} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col p-3 lg:p-4">
          {loading && !items.length ? (
            <p className="text-sm text-muted-foreground">Loading calendar…</p>
          ) : (
            <ScheduleMonthCalendar
              viewYear={viewYear}
              viewMonth={viewMonth}
              onViewMonthChange={(year, month) => {
                setViewYear(year);
                setViewMonth(month);
              }}
              items={items}
              className="min-h-[420px] flex-1 lg:min-h-0"
            />
          )}
        </section>
      </div>
    </div>
  );
}
