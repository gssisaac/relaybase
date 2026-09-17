"use client";

import { CalendarClock, Clock, FileEdit, Mail, Plus, RefreshCw, Send } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { Button } from "@/components/ui/button";
import { dashboardScrollBodyClassName } from "@/console/lib/page-layout";
import { NewNewsletterTemplateDialog } from "@/studio/components/newsletters/NewNewsletterTemplateDialog";
import {
  NewsletterCloudflareLimitsAlertBanner,
  NewsletterCloudflareLimitsAlertShowButton,
} from "@/studio/components/newsletters/NewsletterCloudflareLimitsAlert";
import { NewslettersSectionNav } from "@/studio/components/newsletters/NewslettersSectionNav";
import {
  NewsletterGallerySkeleton,
  NewsletterListKpiSkeleton,
} from "@/studio/components/newsletters/NewsletterLoadingSkeletons";
import {
  StudioGalleryViewToggle,
  type StudioGalleryViewMode,
} from "@/studio/components/gallery/StudioGalleryViewToggle";
import { NewsletterListTable } from "@/studio/components/newsletters/NewsletterListTable";
import { NewsletterThumbnailGrid } from "@/studio/components/newsletters/NewsletterThumbnailGrid";
import { newslettersSectionHref, useStudioPaths } from "@/studio/lib/paths";
import { OverviewKpiCard } from "@/studio/pages/overview/OverviewKpiCard";
import { ListToolbar } from "@/email/components/mailbox/EmailListShell";
import { EmptyListState } from "@/email/components/mailbox/EmailListShell";
import { useNewslettersHub } from "@/studio/stores/newsletters-hub";
import type { Newsletter } from "@/studio/api";
import { cn } from "@/lib/utils";
import {
  NEWSLETTER_FILTER_OPTIONS,
  countNewslettersByFilter,
  matchesNewsletterFilter,
  newsletterFilterLabel,
  type NewsletterFilter,
} from "@/studio/pages/newsletters/newsletter-list-filters";

export type { NewsletterFilter };

function formatWhen(value?: string | null): string {
  if (!value) return "Upcoming";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statsLine(b: Newsletter): string {
  if (b.status === "sending") {
    const total = b.subscriberActiveCount || (b.stats.sent + b.stats.failed);
    const inFlight = b.stats.sent;
    return `Sending… · ${inFlight} of ${total} sent`;
  }
  if (b.status === "scheduled") {
    return `Scheduled for ${formatWhen(b.scheduledAt)} · ${b.subscriberActiveCount.toLocaleString()} recipient${b.subscriberActiveCount === 1 ? "" : "s"}`;
  }
  if (b.status === "sent") {
    const totalSent = b.stats.sent;
    const delivered = b.stats.delivered;
    const opens = b.stats.opened;
    const clicks = b.stats.clicked;
    const parts: string[] = [`${totalSent.toLocaleString()} sent`];
    if (delivered > 0 && opens > 0) {
      const openRate = ((opens / delivered) * 100).toFixed(0);
      parts.push(`${opens} opened (${openRate}%)`);
    } else if (delivered > 0) {
      parts.push(`${delivered} delivered`);
    }
    if (delivered > 0 && clicks > 0) {
      const clickRate = ((clicks / delivered) * 100).toFixed(0);
      parts.push(`${clicks} clicked (${clickRate}%)`);
    }
    return parts.join(" · ");
  }
  if (b.status === "failed") {
    return `Send failed · ${b.stats.failed} failed of ${b.subscriberActiveCount.toLocaleString()} recipients`;
  }
  const count = b.subscriberActiveCount;
  return `${count.toLocaleString()} recipient${count === 1 ? "" : "s"}`;
}

export function NewslettersListView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paths = useStudioPaths();
  const hub = useNewslettersHub();
  const newsletters = hub.newsletters;
  const layouts = hub.layouts;
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<NewsletterFilter>("draft");
  const [listView, setListView] = useState<StudioGalleryViewMode>("card");
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(
    async (force?: boolean) => {
      try {
        await hub.refreshList({ force });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not load newsletters";
        toast.error(message);
      }
    },
    [hub],
  );

  useEffect(() => {
    void hub.refreshList().catch((err) => {
      const message = err instanceof Error ? err.message : "Could not load newsletters";
      toast.error(message);
    });
  }, [hub]);

  useEffect(() => {
    if (searchParams.get("new")?.trim() === "1") {
      setCreateOpen(true);
      router.replace("/studio/newsletters");
    }
  }, [searchParams, router]);

  const counts = useMemo(() => countNewslettersByFilter(newsletters), [newsletters]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return newsletters.filter((b) => {
      if (filter === "archived") {
        if (b.listStatus !== "archived") return false;
      } else {
        if (b.listStatus === "archived") return false;
        if (!matchesNewsletterFilter(b.status, filter)) return false;
      }

      if (!q) return true;
      return (
        b.slug.toLowerCase().includes(q) ||
        b.subject.toLowerCase().includes(q) ||
        (b.subscriberGroupName && b.subscriberGroupName.toLowerCase().includes(q))
      );
    });
  }, [newsletters, filter, search]);

  const filterPills = (
    <div className="inline-flex max-w-full items-center overflow-x-auto rounded-lg bg-muted p-0.5">
      {NEWSLETTER_FILTER_OPTIONS.map((opt) => {
        const count = counts[opt.value];
        const isSelected = filter === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setFilter(opt.value)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors",
              isSelected
                ? "bg-background font-medium text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span>{opt.label}</span>
            <span
              className={cn(
                "text-[10px] tabular-nums",
                isSelected
                  ? "font-medium text-foreground/80"
                  : "text-muted-foreground/70",
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );

  const showPlaceholder = hub.listShowPlaceholder;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <DesktopTitleBar
        className="px-4 py-3"
        end={
          <>
            <NewsletterCloudflareLimitsAlertShowButton />
            <NewNewsletterTemplateDialog
              open={createOpen}
              onOpenChange={setCreateOpen}
              trigger={
                <Button size="sm">
                  <Plus className="size-4" />
                  New newsletter
                </Button>
              }
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => void load(true)}
              disabled={hub.listFetching}
            >
              <RefreshCw className={hub.listRefreshing ? "size-4 animate-spin" : "size-4"} />
            </Button>
          </>
        }
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden sm:gap-3">
          <h1 className="min-w-0 shrink truncate text-sm font-semibold">Newsletters</h1>
          <NewslettersSectionNav active="list" />
        </div>
      </DesktopTitleBar>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
        <div className={dashboardScrollBodyClassName("space-y-4")}>
          <NewsletterCloudflareLimitsAlertBanner />

          {showPlaceholder ? (
            <NewsletterListKpiSkeleton />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <OverviewKpiCard
                icon={FileEdit}
                label="Drafts"
                value={String(counts.draft)}
                hint={`${counts.all} total newsletters`}
                selected={filter === "draft"}
                onClick={() => setFilter("draft")}
              />
              <OverviewKpiCard
                icon={CalendarClock}
                label="Scheduled"
                value={String(counts.scheduled)}
                hint="Queued for a future send"
                selected={filter === "scheduled"}
                onClick={() => setFilter("scheduled")}
                footer={
                  <Link
                    href={paths.schedule}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    View schedule
                  </Link>
                }
              />
              <OverviewKpiCard
                icon={Clock}
                label="In progress"
                value={String(counts.sending)}
                hint="Currently sending"
                selected={filter === "sending"}
                onClick={() => setFilter("sending")}
                footer={
                  <Link
                    href={newslettersSectionHref("in-progress")}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    View send progress
                  </Link>
                }
              />
              <OverviewKpiCard
                icon={Send}
                label="Sent"
                value={String(counts.sent)}
                hint="Filter finished campaigns"
                selected={filter === "sent"}
                onClick={() => setFilter("sent")}
                footer={
                  <Link
                    href={newslettersSectionHref("sent")}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Account send statistics
                  </Link>
                }
              />
            </div>
          )}

          <ListToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search newsletters…"
            leading={filterPills}
            searchTrailing={
              <StudioGalleryViewToggle value={listView} onChange={setListView} />
            }
          />

          {filtered.length > 0 ? (
            listView === "card" ? (
              <NewsletterThumbnailGrid
                newsletters={filtered}
                layouts={layouts}
                statsLine={statsLine}
              />
            ) : (
              <NewsletterListTable
                newsletters={filtered}
                layouts={layouts}
                statsLine={statsLine}
              />
            )
          ) : !hub.listFetching || newsletters.length > 0 ? (
            newsletters.length === 0 ? (
              <EmptyListState
                icon={Mail}
                title="No newsletters loaded"
                description="Start hq/studio on port 32832, restart this app, then refresh. If you use STUDIO_UPSTREAM_URL, do not point it at port 32831 (desktop OAuth)."
                action={
                  <Button size="sm" variant="outline" onClick={() => void load(true)}>
                    Retry
                  </Button>
                }
              />
            ) : (
              <EmptyListState
                icon={Mail}
                title="No matching newsletters"
                description={
                  search
                    ? `No newsletters match "${search}" with filter "${newsletterFilterLabel(filter)}".`
                    : `There are no newsletters with status "${newsletterFilterLabel(filter)}".`
                }
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearch("");
                      setFilter("draft");
                    }}
                  >
                    Reset filters
                  </Button>
                }
              />
            )
          ) : showPlaceholder ? (
            listView === "card" ? (
              <NewsletterGallerySkeleton />
            ) : (
              <div className="min-h-[200px] animate-pulse rounded-lg bg-muted/40" aria-busy="true" />
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
