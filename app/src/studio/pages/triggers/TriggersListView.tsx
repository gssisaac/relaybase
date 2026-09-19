"use client";

import { Plus, RefreshCw, Trash2, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { dashboardScrollBodyClassName } from "@/console/lib/page-layout";
import { TriggerStatusBadge } from "@/studio/components/triggers/TriggerStatusBadge";
import {
  triggerListRelativeDate,
  triggerStatsLine,
  triggerSourceSummary,
} from "@/studio/lib/triggers/trigger-label";
import { triggerDetailHref } from "@/studio/lib/paths";
import { NewTriggerDialog } from "@/studio/pages/triggers/NewTriggerDialog";
import { NewTriggerTemplateDialog } from "@/studio/pages/triggers/NewTriggerTemplateDialog";
import { TriggersListSkeleton } from "@/studio/pages/triggers/TriggersListSkeleton";
import { TriggersOverviewTopSection } from "@/studio/pages/triggers/TriggersOverviewTopSection";
import { studioApi, StudioApiError, type Trigger, type TriggerStatus } from "@/studio/api";
import { useAnalyticsSession } from "@/studio/stores/analytics";
import { useTriggersHub } from "@/studio/stores/triggers-hub";
import { cn } from "@/lib/utils";
import {
  EmailListContainer,
  EmailTableHeader,
  EmailTableRow,
  EmptyListState,
  ListToolbar,
} from "@/email/components/mailbox/EmailListShell";

type TriggerFilter = "all" | TriggerStatus;

const FILTER_OPTIONS: { value: TriggerFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "paused", label: "Paused" },
];

function triggerRowLabel(row: Trigger): string {
  return row.name?.trim() || row.subject?.trim() || "Untitled trigger";
}

export function TriggersListView() {
  const router = useRouter();
  const analytics = useAnalyticsSession();
  const triggersHub = useTriggersHub();
  const rows = triggersHub.triggers;

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TriggerFilter>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Trigger | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    triggersHub.ensureLoaded().catch(() => {
      toast.error(triggersHub.loadError ?? "Could not load triggers");
    });
  }, [triggersHub]);

  useEffect(() => {
    void (analytics.ensureLoaded().catch(() => {
      toast.error("Could not load analytics stats — is hq/studio running on port 32832?");
    }));
  }, [analytics]);

  const counts = useMemo(() => {
    const visible = rows.filter((r) => r.listStatus !== "archived");
    return {
      all: visible.length,
      active: visible.filter((r) => r.status === "active").length,
      paused: visible.filter((r) => r.status === "paused").length,
      draft: visible.filter((r) => r.status === "draft").length,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => r.listStatus !== "archived")
      .filter((r) => (filter === "all" ? true : r.status === filter))
      .filter((r) => {
        if (!q) return true;
        return (
          r.name.toLowerCase().includes(q) ||
          r.slug.includes(q) ||
          triggerSourceSummary(r.source).toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [rows, search, filter]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await studioApi.updateTrigger(deleteTarget.id, { listStatus: "archived" });
      triggersHub.removeTrigger(deleteTarget.id);
      toast.success(`Deleted “${triggerRowLabel(deleteTarget)}”`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof StudioApiError ? err.message : "Could not delete trigger");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <DesktopTitleBar
        className="px-4 py-3"
        end={
          <div className="flex items-center gap-2">
            <NewTriggerTemplateDialog
              open={templateOpen}
              onOpenChange={setTemplateOpen}
              onCreated={(id) => router.push(triggerDetailHref(id, "config"))}
              trigger={
                <Button size="sm" variant="outline">
                  From template
                </Button>
              }
            />
            <NewTriggerDialog
              open={addOpen}
              onOpenChange={setAddOpen}
              onCreated={(id) => router.push(triggerDetailHref(id, "config"))}
              trigger={
                <Button size="sm">
                  <Plus className="size-4" />
                  New trigger
                </Button>
              }
            />
            <Button
              variant="outline"
              size="sm"
              disabled={triggersHub.fetching || analytics.fetching}
              onClick={() => {
                void triggersHub.refresh({ force: true });
                void analytics.refresh({ force: true });
              }}
            >
              <RefreshCw
                className={cn(
                  "size-4",
                  (triggersHub.isRefreshing || analytics.isRefreshing) && "animate-spin",
                )}
              />
            </Button>
          </div>
        }
      >
        <div className="min-w-0 space-y-1">
          <h1 className="truncate text-lg font-semibold tracking-tight">Triggers</h1>
          <p className="text-sm text-muted-foreground">
            Send email when something happens — webhooks, forms, inbox, or internal events.
          </p>
        </div>
      </DesktopTitleBar>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
        <div className={dashboardScrollBodyClassName("flex flex-col gap-4")}>
          {triggersHub.showPlaceholder ? <TriggersListSkeleton /> : null}

          {!triggersHub.showPlaceholder ? (
            <>
              {analytics.showPlaceholder && !analytics.data ? (
                <p className="text-sm text-muted-foreground">Loading stats…</p>
              ) : null}
              {analytics.data ? (
                <TriggersOverviewTopSection
                  data={analytics.data}
                  filter={filter}
                  onFilterChange={setFilter}
                />
              ) : null}

              <EmailListContainer>
                <ListToolbar
                  search={search}
                  onSearchChange={setSearch}
                  searchPlaceholder="Search triggers…"
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
                            <span className="text-[10px] tabular-nums text-muted-foreground/70">
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  }
                />
                {filtered.length === 0 ? (
                  <EmptyListState
                    icon={Zap}
                    title={
                      rows.filter((r) => r.listStatus !== "archived").length === 0
                        ? "No triggers yet"
                        : "No matching triggers"
                    }
                    description={
                      rows.filter((r) => r.listStatus !== "archived").length === 0
                        ? "Create a trigger for verify email, contact forms, or inbox replies."
                        : "Try a different filter or search term."
                    }
                    action={
                      rows.filter((r) => r.listStatus !== "archived").length === 0 ? (
                        <Button size="sm" onClick={() => setAddOpen(true)}>
                          New trigger
                        </Button>
                      ) : (
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
                      )
                    }
                  />
                ) : (
                  <>
                    <EmailTableHeader>
                      <span>Trigger</span>
                      <span className="hidden sm:block">Stats</span>
                      <span className="hidden sm:block">Updated</span>
                      <span className="text-right">Status</span>
                    </EmailTableHeader>
                    <div>
                      {filtered.map((row) => (
                        <ContextMenu key={row.id}>
                          <ContextMenuTrigger render={<div className="contents" />}>
                            <EmailTableRow
                              href={triggerDetailHref(row.id, undefined, row.status)}
                              primary={row.name}
                              subject={triggerStatsLine(row)}
                              preview={triggerSourceSummary(row.source)}
                              date={triggerListRelativeDate(row)}
                              status={
                                <TriggerStatusBadge
                                  status={row.status}
                                  listStatus={row.listStatus}
                                />
                              }
                            />
                          </ContextMenuTrigger>
                          <ContextMenuContent className="min-w-44">
                            <ContextMenuItem
                              variant="destructive"
                              onClick={() => setDeleteTarget(row)}
                            >
                              <Trash2 className="size-4" />
                              Delete trigger
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      ))}
                    </div>
                  </>
                )}
              </EmailListContainer>
            </>
          ) : null}
        </div>
      </div>

      <Dialog open={deleteTarget != null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete trigger?</DialogTitle>
            <DialogDescription>
              {deleteTarget ? (
                <>
                  <span className="font-medium text-foreground">{triggerRowLabel(deleteTarget)}</span>{" "}
                  will be removed from the list and sends will stop.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleting}
              onClick={() => void confirmDelete()}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
