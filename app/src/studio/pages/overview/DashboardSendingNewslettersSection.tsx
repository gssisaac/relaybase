"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NewsletterStatusBadge } from "@/studio/components/newsletters/NewsletterStatusBadge";
import { DashboardNewsletterDispatchStats } from "@/studio/pages/overview/DashboardNewsletterDispatchStats";
import { studioApi, type InProgressOverview } from "@/studio/api";
import { newsletterDetailHref, useStudioPaths } from "@/studio/lib/paths";
import { newsletterDisplaySubject } from "@/studio/lib/newsletters/newsletter-display-subject";
import { cn } from "@/lib/utils";

const POLL_MS = 5_000;

export function DashboardSendingNewslettersSection() {
  const { newslettersInProgress } = useStudioPaths();
  const [data, setData] = useState<InProgressOverview | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await studioApi.getInProgressOverview());
    } catch {
      /* dashboard still usable without this block */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!data?.sending.length) return;
    const id = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(id);
  }, [data?.sending.length, load]);

  const sending = data?.sending ?? [];
  if (sending.length === 0) return null;

  return (
    <Card className="flex h-[232px] w-full shrink-0 flex-col overflow-hidden">
      <CardHeader className="flex shrink-0 flex-row items-start justify-between gap-2 space-y-0 pb-2 pt-4">
        <div className="min-w-0 space-y-0.5">
          <CardTitle className="text-base">Sending now</CardTitle>
          <CardDescription>
            {sending.length === 1
              ? "1 newsletter dispatch in progress"
              : `${sending.length} newsletter dispatches in progress`}
          </CardDescription>
        </div>
        <Link href={newslettersInProgress} className={buttonVariants({ variant: "ghost", size: "sm" })}>
          View all
        </Link>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden pb-4 pt-0">
        <div
          className={cn(
            "flex h-full min-h-0 gap-3",
            sending.length === 1 ? "min-w-0" : "min-w-min pr-1",
          )}
        >
          {sending.map((row) => (
            <div
              key={row.newsletter.id}
              className={cn(
                "flex min-h-0 min-w-0 flex-col gap-2 rounded-lg border bg-muted/20 p-3",
                sending.length === 1 ? "w-full flex-1" : "w-[min(100%,420px)] shrink-0",
              )}
            >
              <div className="flex min-w-0 items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    href={newsletterDetailHref(row.newsletter.id, "publish")}
                    className="truncate text-sm font-semibold hover:underline"
                  >
                    {newsletterDisplaySubject(row.newsletter.subject)}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">
                    {row.newsletter.subscriberGroupName ?? "Subscriber group"}
                  </p>
                </div>
                <NewsletterStatusBadge status={row.newsletter.status} />
              </div>
              <div className="flex min-h-0 flex-1 flex-col justify-between gap-2">
                {row.dispatch ? (
                  <DashboardNewsletterDispatchStats dispatch={row.dispatch} />
                ) : (
                  <p className="text-xs text-muted-foreground">Queue statistics loading…</p>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 w-fit text-xs"
                  nativeButton={false}
                  render={<Link href={newsletterDetailHref(row.newsletter.id, "stats")} />}
                >
                  Open stats
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
