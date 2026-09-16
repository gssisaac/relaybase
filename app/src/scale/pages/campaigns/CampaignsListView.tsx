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
import { AudienceGroupCmdDropdown } from "@/scale/components/AudienceGroupCmdDropdown";
import { resolveEmailApiBase } from "@/lib/desktop/api";
import { CampaignCloudflareSendingLimitsCard } from "@/scale/components/campaigns/CampaignCloudflareSendingLimitsCard";
import { CampaignStatusBadge } from "@/scale/components/campaigns/CampaignStatusBadge";
import { CampaignsSectionNav } from "@/scale/components/campaigns/CampaignsSectionNav";
import { scaleAudienceApi } from "@/lib/scale/audience-api";
import type { AudienceGroupSummary } from "@/email/components/mailbox/types";
import {
  EmailListContainer,
  EmailTableHeader,
  EmailTableRow,
  EmptyListState,
  ListToolbar,
} from "@/email/components/mailbox/EmailListShell";
import { examplePlaceholder } from "@/lib/ui/example-placeholder";
import { campaignDetailHref } from "@/scale/lib/paths";
import {
  scaleApi,
  ScaleApiError,
  type Campaign,
  type CampaignStatus,
} from "@/lib/scale/api";
import { cn } from "@/lib/utils";

export type CampaignFilter = "draft" | "sent" | "in_progress" | "all";

const FILTER_OPTIONS: { value: CampaignFilter; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "in_progress", label: "In progress" },
  { value: "all", label: "All" },
];

function filterLabel(filter: CampaignFilter): string {
  return FILTER_OPTIONS.find((o) => o.value === filter)?.label ?? filter;
}

function matchesCampaignFilter(
  status: CampaignStatus,
  filter: CampaignFilter,
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

function statsLine(b: Campaign): string {
  if (b.status === "sending") {
    const total = b.audienceActiveCount || (b.stats.sent + b.stats.failed);
    const inFlight = b.stats.sent;
    return `Sending… · ${inFlight} of ${total} sent`;
  }
  if (b.status === "scheduled") {
    return `Scheduled for ${formatWhen(b.scheduledAt)} · ${b.audienceActiveCount.toLocaleString()} recipient${b.audienceActiveCount === 1 ? "" : "s"}`;
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
    return `Send failed · ${b.stats.failed} failed of ${b.audienceActiveCount.toLocaleString()} recipients`;
  }
  // draft
  const count = b.audienceActiveCount;
  return `${count.toLocaleString()} recipient${count === 1 ? "" : "s"}`;
}

export function CampaignsListView() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<CampaignFilter>("draft");
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAudienceGroupId, setNewAudienceGroupId] = useState<string>("");
  const [audienceGroups, setAudienceGroups] = useState<AudienceGroupSummary[]>([]);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(async (force?: boolean) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    try {
      const list = await scaleApi.listCampaigns();
      setCampaigns(list.campaigns);
    } catch {
      toast.error("Could not load campaigns");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const hasSending = useMemo(
    () => campaigns.some((b) => b.status === "sending"),
    [campaigns],
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
    setAudienceLoading(true);
    scaleAudienceApi
      .listGroups()
      .then(({ groups }) => setAudienceGroups(groups))
      .catch(() => toast.error("Could not load subscriber groups"))
      .finally(() => setAudienceLoading(false));
  }, [createOpen]);

  const counts = useMemo(() => {
    const visible = campaigns.filter((b) => b.listStatus !== "archived");
    return {
      draft: visible.filter((b) => b.status === "draft").length,
      sent: visible.filter((b) => b.status === "sent").length,
      in_progress: visible.filter(
        (b) => b.status === "scheduled" || b.status === "sending",
      ).length,
      all: visible.length,
    };
  }, [campaigns]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return campaigns.filter((b) => {
      if (b.listStatus === "archived") return false;
      if (!matchesCampaignFilter(b.status, filter)) return false;

      if (!q) return true;
      return (
        b.name.toLowerCase().includes(q) ||
        b.slug.toLowerCase().includes(q) ||
        b.subject.toLowerCase().includes(q) ||
        (b.audienceGroupName && b.audienceGroupName.toLowerCase().includes(q))
      );
    });
  }, [campaigns, filter, search]);

  function resetCreate() {
    setNewName("");
    setNewAudienceGroupId("");
    setCreateError(null);
    setCreating(false);
  }

  async function handleCreate() {
    const name = newName.trim();
    const audienceGroupId = newAudienceGroupId.trim();
    const group = audienceGroups.find((g) => g.id === audienceGroupId);
    const domain = group?.domain.trim().toLowerCase();
    if (!name) {
      setCreateError("Campaign name is required");
      return;
    }
    if (!audienceGroupId || !domain) {
      setCreateError("Select a subscriber group");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const workerUrl = resolveEmailApiBase();
      const created = await scaleApi.createCampaign({
        name,
        domain,
        audienceGroupId,
        ...(workerUrl ? { workerUrl } : {}),
      });
      toast.success(`Campaign '${created.name}' created`);
      setCreateOpen(false);
      resetCreate();
      router.push(campaignDetailHref(created.id, "content"));
    } catch (err) {
      setCreateError(err instanceof ScaleApiError ? err.message : "Could not create campaign");
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
                New campaign
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
              <h1 className="truncate text-lg font-semibold tracking-tight">Campaigns</h1>
              <p className="text-sm text-muted-foreground">
                Email campaigns with linked audience and send lifecycle
              </p>
            </div>
            <CampaignsSectionNav active="list" />
          </div>
        </DesktopTitleBar>

        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New campaign</DialogTitle>
            <DialogDescription>
              Choose a subscriber group — sending domain comes from the group.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="campaign-name">Name</Label>
              <Input
                id="campaign-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={examplePlaceholder("Engineering Updates")}
                autoComplete="off"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="campaign-audience">Subscriber group</Label>
              <AudienceGroupCmdDropdown
                triggerId="campaign-audience"
                groups={audienceGroups}
                loading={audienceLoading}
                value={newAudienceGroupId || null}
                onValueChange={(id) => setNewAudienceGroupId(id ?? "")}
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
              disabled={creating || !newName.trim() || !newAudienceGroupId.trim()}
              onClick={() => void handleCreate()}
            >
              {creating ? "Creating…" : "Create campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
        <div className={dashboardScrollBodyClassName("space-y-4")}>
          <CampaignCloudflareSendingLimitsCard />
          <EmailListContainer>
            <ListToolbar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search campaigns…"
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
                  <span>Campaign</span>
                  <span className="hidden sm:block">Stats</span>
                  <span className="hidden sm:block">Updated</span>
                  <span className="text-right">Status</span>
                </EmailTableHeader>
                <div>
                  {filtered.map((b) => (
                    <EmailTableRow
                      key={b.id}
                      href={campaignDetailHref(b.id)}
                      primary={b.name}
                      subject={statsLine(b)}
                      preview={b.audienceGroupName ?? b.fromEmail ?? undefined}
                      date={new Date(b.updatedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                      status={
                        <CampaignStatusBadge
                          status={b.status}
                          listStatus={b.listStatus}
                        />
                      }
                    />
                  ))}
                </div>
              </>
            ) : !loading ? (
              campaigns.length === 0 ? (
                <EmptyListState
                  icon={Mail}
                  title="No campaigns yet"
                  description="Create a campaign to sync an audience and send email."
                  action={
                    <Button
                      size="sm"
                      onClick={() => {
                        resetCreate();
                        setCreateOpen(true);
                      }}
                    >
                      New campaign
                    </Button>
                  }
                />
              ) : (
                <EmptyListState
                  icon={Mail}
                  title="No matching campaigns"
                  description={
                    search
                      ? `No campaigns match "${search}" with filter "${filterLabel(filter)}".`
                      : `There are no campaigns with status "${filterLabel(filter)}".`
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
