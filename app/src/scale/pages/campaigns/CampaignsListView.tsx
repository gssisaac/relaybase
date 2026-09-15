"use client";

import { LayoutTemplate, Mail, Plus, RefreshCw } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { dashboardScrollBodyClassName } from "@/console/lib/page-layout";
import { useWorkerDomains } from "@/scale/lib/use-worker-domains";
import { resolveEmailApiBase } from "@/lib/desktop/api";
import { BroadcastCloudflareSendingLimitsCard } from "@/scale/components/BroadcastCloudflareSendingLimitsCard";
import { BroadcastStatusBadge } from "@/scale/components/BroadcastStatusBadge";
import { ScaleTemplateLibraryDialog } from "@/scale/components/ScaleTemplateLibraryDialog";
import { BroadcastsSectionNav } from "@/scale/components/BroadcastsSectionNav";
import { scaleAudienceApi } from "@/lib/scale/audience-api";
import type { AudienceGroupSummary } from "@/email/components/mailbox/types";
import {
  EmailListContainer,
  EmailTableHeader,
  EmailTableRow,
  EmptyListState,
  ListToolbar,
} from "@/email/components/mailbox/EmailListShell";
import { broadcastDetailHref } from "@/scale/lib/paths";
import {
  scaleApi,
  ScaleApiError,
  type Broadcast,
  type BroadcastStatus,
} from "@/lib/scale/api";
import { cn } from "@/lib/utils";

export type BroadcastFilter = "draft" | "sent" | "in_progress" | "all";

const FILTER_OPTIONS: { value: BroadcastFilter; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "in_progress", label: "In progress" },
  { value: "all", label: "All" },
];

function filterLabel(filter: BroadcastFilter): string {
  return FILTER_OPTIONS.find((o) => o.value === filter)?.label ?? filter;
}

function matchesBroadcastFilter(
  status: BroadcastStatus,
  filter: BroadcastFilter,
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

function statsLine(b: Broadcast): string {
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

export function BroadcastsListView() {
  const router = useRouter();
  const {
    readyDomains,
    loading: workerDomainsLoading,
    refresh: refreshWorkerDomains,
  } = useWorkerDomains();
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<BroadcastFilter>("draft");
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDomain, setNewDomain] = useState<string | null>(null);
  const [newAudienceGroupId, setNewAudienceGroupId] = useState<string>("");
  const [audienceGroups, setAudienceGroups] = useState<AudienceGroupSummary[]>([]);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(async (force?: boolean) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    try {
      const list = await scaleApi.listBroadcasts();
      setBroadcasts(list.broadcasts);
    } catch {
      toast.error("Could not load broadcasts");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const hasSending = useMemo(
    () => broadcasts.some((b) => b.status === "sending"),
    [broadcasts],
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
    void refreshWorkerDomains();
    setAudienceLoading(true);
    scaleAudienceApi
      .listGroups()
      .then(({ groups }) => setAudienceGroups(groups))
      .catch(() => toast.error("Could not load audience groups"))
      .finally(() => setAudienceLoading(false));
  }, [createOpen, refreshWorkerDomains]);

  const counts = useMemo(() => {
    const visible = broadcasts.filter((b) => b.listStatus !== "archived");
    return {
      draft: visible.filter((b) => b.status === "draft").length,
      sent: visible.filter((b) => b.status === "sent").length,
      in_progress: visible.filter(
        (b) => b.status === "scheduled" || b.status === "sending",
      ).length,
      all: visible.length,
    };
  }, [broadcasts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return broadcasts.filter((b) => {
      if (b.listStatus === "archived") return false;
      if (!matchesBroadcastFilter(b.status, filter)) return false;

      if (!q) return true;
      return (
        b.name.toLowerCase().includes(q) ||
        b.slug.toLowerCase().includes(q) ||
        b.subject.toLowerCase().includes(q) ||
        (b.audienceGroupName && b.audienceGroupName.toLowerCase().includes(q))
      );
    });
  }, [broadcasts, filter, search]);

  const groupsForDomain = useMemo(() => {
    const d = newDomain?.toLowerCase();
    if (!d) return [];
    return audienceGroups.filter((g) => g.domain.toLowerCase() === d);
  }, [audienceGroups, newDomain]);

  const audienceSelectItems = useMemo(
    () =>
      groupsForDomain.map((g) => ({
        value: g.id,
        label: `${g.name} · ${g.contactCount} contacts`,
      })),
    [groupsForDomain],
  );

  function resetCreate() {
    setNewName("");
    setNewDomain(readyDomains[0]?.domain ?? null);
    setNewAudienceGroupId("");
    setCreateError(null);
    setCreating(false);
  }

  async function handleCreate() {
    const name = newName.trim();
    const audienceGroupId = newAudienceGroupId.trim();
    if (!name) {
      setCreateError("Broadcast name is required");
      return;
    }
    if (!newDomain) {
      setCreateError("Select a sending domain");
      return;
    }
    if (!audienceGroupId) {
      setCreateError("Select an audience group");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const workerUrl = resolveEmailApiBase();
      const created = await scaleApi.createBroadcast({
        name,
        domain: newDomain,
        audienceGroupId,
        ...(workerUrl ? { workerUrl } : {}),
      });
      toast.success(`Broadcast '${created.name}' created`);
      setCreateOpen(false);
      resetCreate();
      router.push(broadcastDetailHref(created.id, "content"));
    } catch (err) {
      setCreateError(err instanceof ScaleApiError ? err.message : "Could not create broadcast");
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
              <ScaleTemplateLibraryDialog
                trigger={
                  <Button size="sm" variant="outline">
                    <LayoutTemplate className="size-4" />
                    Templates
                  </Button>
                }
              />
              <DialogTrigger
                render={<Button size="sm" />}
                onClick={() => {
                  resetCreate();
                }}
              >
                <Plus className="size-4" />
                New broadcast
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
              <h1 className="truncate text-lg font-semibold tracking-tight">Broadcasts</h1>
              <p className="text-sm text-muted-foreground">
                Email broadcasts with linked audience and send lifecycle
              </p>
            </div>
            <BroadcastsSectionNav active="list" />
          </div>
        </DesktopTitleBar>

        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New broadcast</DialogTitle>
            <DialogDescription>
              Pick a domain from your Worker, then an audience group on that domain.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="broadcast-name">Name</Label>
              <Input
                id="broadcast-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Engineering Updates"
                autoComplete="off"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="broadcast-domain">Domain</Label>
              <Select
                value={newDomain}
                onValueChange={(value) => {
                  setNewDomain(value);
                  setNewAudienceGroupId("");
                }}
              >
                <SelectTrigger id="broadcast-domain" className="w-full">
                  <SelectValue placeholder="Select domain" />
                </SelectTrigger>
                <SelectContent>
                  {readyDomains.map((d) => (
                    <SelectItem key={d.domain} value={d.domain}>
                      {d.domain}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {workerDomainsLoading ? (
                <p className="text-xs text-muted-foreground">Loading domains from Worker…</p>
              ) : readyDomains.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No domains on your Worker yet — add one in Console → Domains.
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="broadcast-audience">Audience</Label>
              {audienceLoading ? (
                <p className="text-sm text-muted-foreground">Loading audience groups…</p>
              ) : !newDomain ? (
                <p className="text-sm text-muted-foreground">Select a domain first.</p>
              ) : groupsForDomain.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No audience groups on this domain — create one in Audience first.
                </p>
              ) : (
                <Select
                  items={audienceSelectItems}
                  value={newAudienceGroupId || null}
                  onValueChange={(value) => setNewAudienceGroupId(value ?? "")}
                >
                  <SelectTrigger id="broadcast-audience" className="w-full">
                    <SelectValue placeholder="Select audience group" />
                  </SelectTrigger>
                  <SelectContent>
                    {groupsForDomain.map((g) => {
                      const label = `${g.name} · ${g.contactCount} contacts`;
                      return (
                        <SelectItem key={g.id} value={g.id} label={label}>
                          {label}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
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
              disabled={
                creating || !newName.trim() || !newDomain || !newAudienceGroupId.trim()
              }
              onClick={() => void handleCreate()}
            >
              {creating ? "Creating…" : "Create broadcast"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
        <div className={dashboardScrollBodyClassName("space-y-4")}>
          <BroadcastCloudflareSendingLimitsCard />
          <EmailListContainer>
            <ListToolbar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search broadcasts…"
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
                  <span>Broadcast</span>
                  <span className="hidden sm:block">Stats</span>
                  <span className="hidden sm:block">Updated</span>
                  <span className="text-right">Status</span>
                </EmailTableHeader>
                <div>
                  {filtered.map((b) => (
                    <EmailTableRow
                      key={b.id}
                      href={broadcastDetailHref(b.id)}
                      primary={b.name}
                      subject={statsLine(b)}
                      preview={b.audienceGroupName ?? b.fromEmail ?? undefined}
                      date={new Date(b.updatedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                      status={
                        <BroadcastStatusBadge
                          status={b.status}
                          listStatus={b.listStatus}
                        />
                      }
                    />
                  ))}
                </div>
              </>
            ) : !loading ? (
              broadcasts.length === 0 ? (
                <EmptyListState
                  icon={Mail}
                  title="No broadcasts yet"
                  description="Create a broadcast to sync an audience and send email."
                  action={
                    <Button
                      size="sm"
                      onClick={() => {
                        resetCreate();
                        setCreateOpen(true);
                      }}
                    >
                      New broadcast
                    </Button>
                  }
                />
              ) : (
                <EmptyListState
                  icon={Mail}
                  title="No matching broadcasts"
                  description={
                    search
                      ? `No broadcasts match "${search}" with filter "${filterLabel(filter)}".`
                      : `There are no broadcasts with status "${filterLabel(filter)}".`
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

/** @deprecated use BroadcastsListView */
export const CampaignsListView = BroadcastsListView;
