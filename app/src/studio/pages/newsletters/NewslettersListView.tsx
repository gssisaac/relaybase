"use client";

import { Mail, Plus, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dashboardScrollBodyClassName } from "@/console/lib/page-layout";
import { SubscriberGroupCmdDropdown } from "@/studio/components/SubscriberGroupCmdDropdown";
import { resolveEmailApiBase } from "@/lib/desktop/api";
import { NewsletterCloudflareSendingLimitsCard } from "@/studio/components/newsletters/NewsletterCloudflareSendingLimitsCard";
import { NewsletterStatusBadge } from "@/studio/components/newsletters/NewsletterStatusBadge";
import { NewslettersSectionNav } from "@/studio/components/newsletters/NewslettersSectionNav";
import { studioSubscriberApi } from "@/studio/api";
import type { SubscriberGroupSummary } from "@/email/components/mailbox/types";
import {
  EmailListContainer,
  EmailTableHeader,
  EmailTableRow,
  EmptyListState,
  ListToolbar,
} from "@/email/components/mailbox/EmailListShell";
import { examplePlaceholder } from "@/lib/ui/example-placeholder";
import { newsletterDetailHref } from "@/studio/lib/paths";
import {
  studioApi,
  StudioApiError,
  type Newsletter,
  type NewsletterStatus,
} from "@/studio/api";
import { cn } from "@/lib/utils";

export type NewsletterFilter = "draft" | "sent" | "in_progress" | "all";

const FILTER_OPTIONS: { value: NewsletterFilter; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "in_progress", label: "In progress" },
  { value: "all", label: "All" },
];

function filterLabel(filter: NewsletterFilter): string {
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
  // draft
  const count = b.subscriberActiveCount;
  return `${count.toLocaleString()} recipient${count === 1 ? "" : "s"}`;
}

export function NewslettersListView() {
  const router = useRouter();
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<NewsletterFilter>("draft");
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSubscriberGroupId, setNewSubscriberGroupId] = useState<string>("");
  const [subscriberGroups, setSubscriberGroups] = useState<SubscriberGroupSummary[]>([]);
  const [subscriberGroupsLoading, setSubscriberGroupsLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(async (force?: boolean) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    try {
      const list = await studioApi.listNewsletters();
      setNewsletters(list.newsletters);
    } catch {
      toast.error("Could not load newsletters");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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

  useEffect(() => {
    if (!createOpen) return;
    setSubscriberGroupsLoading(true);
    studioSubscriberApi
      .listGroups()
      .then(({ groups }) => setSubscriberGroups(groups))
      .catch(() => toast.error("Could not load subscriber groups"))
      .finally(() => setSubscriberGroupsLoading(false));
  }, [createOpen]);

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

  function resetCreate() {
    setNewName("");
    setNewSubscriberGroupId("");
    setCreateError(null);
    setCreating(false);
  }

  async function handleCreate() {
    const name = newName.trim();
    const subscriberGroupId = newSubscriberGroupId.trim();
    const group = subscriberGroups.find((g) => g.id === subscriberGroupId);
    const domain = group?.domain.trim().toLowerCase();
    if (!name) {
      setCreateError("Newsletter name is required");
      return;
    }
    if (!subscriberGroupId || !domain) {
      setCreateError("Select a subscriber group");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const workerUrl = resolveEmailApiBase();
      const created = await studioApi.createNewsletter({
        name,
        domain,
        subscriberGroupId,
        ...(workerUrl ? { workerUrl } : {}),
      });
      toast.success(`Newsletter '${created.name}' created`);
      setCreateOpen(false);
      resetCreate();
      router.push(newsletterDetailHref(created.id, "content"));
    } catch (err) {
      setCreateError(err instanceof StudioApiError ? err.message : "Could not create newsletter");
      setCreating(false);
    }
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (open) resetCreate();
          else resetCreate();
        }}
      >
        <DesktopTitleBar
          className="px-4 py-3"
          end={
            <>
              <DialogTrigger
                render={<Button size="sm" />}
                onClick={() => {
                  resetCreate();
                }}
              >
                <Plus className="size-4" />
                New newsletter
              </DialogTrigger>
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
          <div className="min-w-0 space-y-2">
            <div>
              <h1 className="truncate text-lg font-semibold tracking-tight">Newsletters</h1>
              <p className="text-sm text-muted-foreground">
                Email newsletters with linked subscriber group and send lifecycle
              </p>
            </div>
            <NewslettersSectionNav active="list" />
          </div>
        </DesktopTitleBar>

        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New newsletter</DialogTitle>
            <DialogDescription>
              Choose a subscriber group — sending domain comes from the group.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="newsletter-name">Name</Label>
              <Input
                id="newsletter-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={examplePlaceholder("Engineering Updates")}
                autoComplete="off"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newsletter-audience">Subscriber group</Label>
              <SubscriberGroupCmdDropdown
                triggerId="newsletter-audience"
                groups={subscriberGroups}
                loading={subscriberGroupsLoading}
                value={newSubscriberGroupId || null}
                onValueChange={(id) => setNewSubscriberGroupId(id ?? "")}
              />
              {createError ? <p className="text-xs text-destructive">{createError}</p> : null}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={creating}
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={creating || !newName.trim() || !newSubscriberGroupId.trim()}
              onClick={() => void handleCreate()}
            >
              {creating ? "Creating…" : "Create newsletter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
        <div className={dashboardScrollBodyClassName("space-y-4")}>
          <NewsletterCloudflareSendingLimitsCard />
          <EmailListContainer>
            <ListToolbar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search newsletters…"
              trailing={
                <div className="inline-flex max-w-full items-center overflow-x-auto rounded-lg bg-muted p-0.5">
                  {FILTER_OPTIONS.map((opt) => {
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
              }
            />
            {filtered.length > 0 ? (
              <>
                <EmailTableHeader>
                  <span>Newsletter</span>
                  <span className="hidden sm:block">Stats</span>
                  <span className="hidden sm:block">Updated</span>
                  <span className="text-right">Status</span>
                </EmailTableHeader>
                <div>
                  {filtered.map((b) => (
                    <EmailTableRow
                      key={b.id}
                      href={newsletterDetailHref(b.id)}
                      primary={b.name}
                      subject={statsLine(b)}
                      preview={b.subscriberGroupName ?? b.fromEmail ?? undefined}
                      date={new Date(b.updatedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                      status={
                        <NewsletterStatusBadge
                          status={b.status}
                          listStatus={b.listStatus}
                        />
                      }
                    />
                  ))}
                </div>
              </>
            ) : !loading ? (
              newsletters.length === 0 ? (
                <EmptyListState
                  icon={Mail}
                  title="No newsletters yet"
                  description="Create a newsletter to link a subscriber group and send email."
                  action={
                    <Button
                      size="sm"
                      onClick={() => {
                        resetCreate();
                        setCreateOpen(true);
                      }}
                    >
                      New newsletter
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
                        setFilter("draft");
                      }}
                    >
                      Reset filters
                    </Button>
                  }
                />
              )
            ) : (
              <div className="min-h-[200px]" />
            )}
          </EmailListContainer>
        </div>
      </div>
    </div>
  );
}
