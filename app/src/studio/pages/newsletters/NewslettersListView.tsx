"use client";

import { Clock, FileEdit, Mail, Plus, RefreshCw, Send } from "lucide-react";
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
import { NewsletterThumbnailGrid } from "@/studio/components/newsletters/NewsletterThumbnailGrid";
import { newslettersSectionHref } from "@/studio/lib/paths";
import { OverviewKpiCard } from "@/studio/pages/overview/OverviewKpiCard";
import { ListToolbar } from "@/email/components/mailbox/EmailListShell";
import { EmptyListState } from "@/email/components/mailbox/EmailListShell";
import {
  studioApi,
  type Newsletter,
  type NewsletterStatus,
  type StudioLayout,
} from "@/studio/api";
import { cn } from "@/lib/utils";

export type NewsletterFilter = "draft" | "sent" | "in_progress" | "all";

const FILTER_OPTIONS: { value: Exclude<NewsletterFilter, "all">; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "in_progress", label: "In progress" },
];

function filterLabel(filter: NewsletterFilter): string {
  if (filter === "all") return "All";
  return FILTER_OPTIONS.find((o) => o.value === filter)?.label ?? filter;
}

function matchesNewsletterFilter(
  status: NewsletterStatus,
  filter: NewsletterFilter,
): boolean {
  switch (filter) {
    case "draft":
      return status === "draft";
    case "sent":
      return status === "sent";
    case "in_progress":
      return status === "scheduled" || status === "sending";
    case "all":
    default:
      return true;
  }
}

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
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [layouts, setLayouts] = useState<StudioLayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<NewsletterFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async (force?: boolean) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    try {
      const [list, layoutRes] = await Promise.all([
        studioApi.listNewsletters(),
        studioApi.listLayouts(),
      ]);
      setNewsletters(list.newsletters);
      setLayouts(layoutRes.layouts);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not load newsletters";
      toast.error(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (searchParams.get("new")?.trim() === "1") {
      setCreateOpen(true);
      router.replace("/studio/newsletters");
    }
  }, [searchParams, router]);

  const hasSending = useMemo(
    () => newsletters.some((b) => b.status === "sending"),
    [newsletters],
  );

  useEffect(() => {
    if (!hasSending) return;
    const interval = setInterval(() => {
      void load(false);
    }, 3000);
    return () => clearInterval(interval);
  }, [hasSending, load]);

  const counts = useMemo(() => {
    const visible = newsletters.filter((b) => b.listStatus !== "archived");
    return {
      draft: visible.filter((b) => b.status === "draft").length,
      sent: visible.filter((b) => b.status === "sent").length,
      in_progress: visible.filter(
        (b) => b.status === "scheduled" || b.status === "sending",
      ).length,
      all: visible.length,
    };
  }, [newsletters]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return newsletters.filter((b) => {
      if (b.listStatus === "archived") return false;
      if (!matchesNewsletterFilter(b.status, filter)) return false;

      if (!q) return true;
      return (
        b.name.toLowerCase().includes(q) ||
        b.slug.toLowerCase().includes(q) ||
        b.subject.toLowerCase().includes(q) ||
        (b.subscriberGroupName && b.subscriberGroupName.toLowerCase().includes(q))
      );
    });
  }, [newsletters, filter, search]);

  function toggleFilter(next: Exclude<NewsletterFilter, "all">) {
    setFilter((prev) => (prev === next ? "all" : next));
  }

  const initialLoad = loading && newsletters.length === 0;

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
              disabled={refreshing}
            >
              <RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} />
            </Button>
          </>
        }
      >
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <h1 className="truncate text-lg font-semibold tracking-tight">Newsletters</h1>
          <NewslettersSectionNav active="list" />
        </div>
      </DesktopTitleBar>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
        <div className={dashboardScrollBodyClassName("space-y-4")}>
          <NewsletterCloudflareLimitsAlertBanner />

          {initialLoad ? (
            <NewsletterListKpiSkeleton />
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <OverviewKpiCard
                icon={FileEdit}
                label="Drafts"
                value={String(counts.draft)}
                hint={`${counts.all} total newsletters`}
                selected={filter === "draft"}
                onClick={() => toggleFilter("draft")}
              />
              <OverviewKpiCard
                icon={Clock}
                label="In progress"
                value={String(counts.in_progress)}
                hint="Filter scheduled & sending"
                selected={filter === "in_progress"}
                onClick={() => toggleFilter("in_progress")}
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
                onClick={() => toggleFilter("sent")}
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
            trailing={
              filter !== "all" ? (
                <div className="inline-flex max-w-full items-center overflow-x-auto rounded-lg bg-muted p-0.5">
                  {FILTER_OPTIONS.map((opt) => {
                    const count = counts[opt.value];
                    const isSelected = filter === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggleFilter(opt.value)}
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
              ) : null
            }
          />

          {filtered.length > 0 ? (
            <NewsletterThumbnailGrid
              newsletters={filtered}
              layouts={layouts}
              statsLine={statsLine}
            />
          ) : !loading ? (
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
                    ? `No newsletters match "${search}" with filter "${filterLabel(filter)}".`
                    : `There are no newsletters with status "${filterLabel(filter)}".`
                }
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearch("");
                      setFilter("all");
                    }}
                  >
                    Reset filters
                  </Button>
                }
              />
            )
          ) : initialLoad ? (
            <NewsletterGallerySkeleton />
          ) : null}
        </div>
      </div>
    </div>
  );
}
