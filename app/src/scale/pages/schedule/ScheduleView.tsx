"use client";

import Link from "next/link";
import { CalendarClock, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScheduleItemPopover } from "@/scale/components/ScheduleItemPopover";
import { ScheduleMonthCalendar } from "@/scale/components/ScheduleMonthCalendar";
import { useScalePaths } from "@/scale/lib/paths";
import {
  mergeBroadcastSnapshots,
  upcomingBroadcastScheduleItems,
  type ScheduleItem,
} from "@/scale/lib/schedule-items";
import { scaleApi } from "@/lib/scale/api";
/** Match ScaleOverviewView inset rows — bg lift, no borders. */
const scheduleInsetItemClassName =
  "rounded-xl bg-secondary/70 px-3 py-2.5 transition-colors hover:bg-secondary dark:bg-accent/90 dark:hover:bg-accent";

const scheduleInsetHighlightClassName = "rounded-xl bg-secondary px-3 py-2.5 dark:bg-accent";

function countUpcomingWithinDays(items: ScheduleItem[], from: Date, days: number): number {
  const endMs = from.getTime() + days * 24 * 60 * 60 * 1000;
  return items.filter((item) => item.at.getTime() <= endMs).length;
}

export function ScheduleView() {
  const { broadcasts } = useScalePaths();
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const now = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(() => now.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => now.getMonth());

  const upcomingIn7Days = useMemo(
    () => countUpcomingWithinDays(items, now, 7),
    [items, now],
  );
  const nextUp = items[0] ?? null;
  const restUpcoming = items.slice(1);

  const load = useCallback(async (force?: boolean) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    try {
      const [{ broadcasts: list }, overview] = await Promise.all([
        scaleApi.listBroadcasts(),
        scaleApi.getInProgressOverview(),
      ]);
      const merged = mergeBroadcastSnapshots(list, overview.scheduled);
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

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden p-4 lg:flex-row">
        <Card className="flex min-h-0 w-full max-h-[min(52vh,28rem)] shrink-0 flex-col overflow-hidden lg:max-h-none lg:w-80 lg:self-stretch xl:w-96">
          <CardHeader className="flex shrink-0 flex-row items-start justify-between gap-2 space-y-0 pb-2">
            <div>
              <CardTitle className="text-base">Upcoming schedule</CardTitle>
              <CardDescription>
                {loading && !items.length
                  ? "Loading…"
                  : `${upcomingIn7Days} in the next 7 days`}
              </CardDescription>
            </div>
            <Link href={broadcasts} className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Broadcasts
            </Link>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden pt-0">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
              {loading && !items.length ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <CalendarClock className="size-9 text-muted-foreground/60" aria-hidden />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Nothing scheduled yet</p>
                    <p className="text-xs text-muted-foreground">
                      Schedule a broadcast from Publish when you are ready to send.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={broadcasts}>Open broadcasts</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 pb-1">
                  {nextUp ? (
                    <ScheduleItemPopover
                      item={nextUp}
                      variant="nextUp"
                      nextUpInsetClassName={scheduleInsetHighlightClassName}
                    />
                  ) : null}
                  {restUpcoming.length > 0 ? (
                    <ul className="space-y-2">
                      {restUpcoming.map((item) => (
                        <li key={item.id}>
                          <ScheduleItemPopover
                            item={item}
                            variant="list"
                            listInsetClassName={scheduleInsetItemClassName}
                          />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <CardContent className="flex min-h-0 flex-1 flex-col pt-4">
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
