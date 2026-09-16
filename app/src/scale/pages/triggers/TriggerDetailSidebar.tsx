"use client";

import { MoreHorizontal, Plus, Search, Trash2, Zap } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { memo, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { PanelSplitHandle } from "@/components/ui/panel-split-handle";
import { usePersistedTriggerDetailSidebarWidth } from "@/hooks/use-persisted-trigger-detail-sidebar-width";
import { TriggerStatusBadge } from "@/scale/components/triggers/TriggerStatusBadge";
import {
  triggerDetailHref,
  triggerTabFromPathname,
  useScalePaths,
  type TriggerDetailTab,
} from "@/scale/lib/paths";
import {
  triggerListRelativeDate,
  triggerSourceSummary,
} from "@/scale/lib/triggers/trigger-label";
import {
  getTriggerSidebarListSnapshot,
  removeTriggerSidebarListRow,
} from "@/scale/lib/triggers/trigger-sidebar-list";
import { NewTriggerDialog } from "@/scale/pages/triggers/NewTriggerDialog";
import { useTriggerDetail } from "@/scale/pages/triggers/TriggerDetailContext";
import { useTriggerSidebarList } from "@/scale/pages/triggers/use-trigger-sidebar-list";
import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import { scaleApi, ScaleApiError, type Trigger, type TriggerStatus } from "@/lib/scale/api";
import { cn } from "@/lib/utils";

type TriggerSidebarFilter = "all" | TriggerStatus;

const SIDEBAR_FILTER_OPTIONS: { value: TriggerSidebarFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "paused", label: "Paused" },
];

function triggerRowLabel(row: Trigger): string {
  return row.name?.trim() || row.subject?.trim() || "Untitled trigger";
}

function TriggerSidebarDeleteActions({ onDelete }: { onDelete: () => void }) {
  return (
    <DropdownMenuItem variant="destructive" onClick={onDelete}>
      <Trash2 className="size-4" />
      Delete trigger
    </DropdownMenuItem>
  );
}

const TriggerSidebarRow = memo(function TriggerSidebarRow({
  row,
  active,
  tab,
  onRequestDelete,
}: {
  row: Trigger;
  active: boolean;
  tab: TriggerDetailTab;
  onRequestDelete: (row: Trigger) => void;
}) {
  const label = triggerRowLabel(row);
  const href = triggerDetailHref(row.id, tab);

  const rowBody = (
    <div
      className={cn(
        "relative flex min-w-0 rounded-md transition-colors",
        active ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-accent/60",
      )}
    >
      <Link
        href={href}
        className="flex min-w-0 flex-1 flex-col gap-1 px-2.5 py-2 pr-8 text-left"
        aria-current={active ? "page" : undefined}
      >
        <div className="flex min-w-0 items-baseline justify-between gap-2">
          <span className="min-w-0 flex-1 truncate text-xs font-medium">{label}</span>
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground group-hover/sidebar-row:invisible">
            {triggerListRelativeDate(row)}
          </span>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <TriggerStatusBadge
            status={row.status}
            listStatus={row.listStatus}
            className="w-fit shrink-0 whitespace-nowrap"
          />
          <span className="truncate text-[10px] text-muted-foreground">
            {triggerSourceSummary(row.source)}
          </span>
        </div>
      </Link>
      <div className="absolute right-0.5 top-1/2 -translate-y-1/2">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground opacity-0 transition-opacity group-hover/sidebar-row:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100"
                aria-label={`Actions for ${label}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              />
            }
          >
            <MoreHorizontal className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            <TriggerSidebarDeleteActions onDelete={() => onRequestDelete(row)} />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <li className="group/sidebar-row">
      <ContextMenu>
        <ContextMenuTrigger render={<div className="contents" />}>{rowBody}</ContextMenuTrigger>
        <ContextMenuContent className="min-w-44">
          <ContextMenuItem variant="destructive" onClick={() => onRequestDelete(row)}>
            <Trash2 className="size-4" />
            Delete trigger
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </li>
  );
});

function TriggerSidebarHeader({
  addOpen,
  setAddOpen,
  onCreated,
}: {
  addOpen: boolean;
  setAddOpen: (open: boolean) => void;
  onCreated: (triggerId: string) => void;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-2.5 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <Zap className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="truncate text-xs font-semibold tracking-tight">Triggers</span>
      </div>
      <NewTriggerDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={onCreated}
        trigger={
          <Button type="button" size="icon-sm" variant="ghost" aria-label="New trigger">
            <Plus className="size-4" />
          </Button>
        }
      />
    </div>
  );
}

function TriggerDetailSidebarInner() {
  const router = useRouter();
  const { triggers: triggersPath } = useScalePaths();
  const userId = useProductId();
  const pathname = usePathname();
  const currentTab = triggerTabFromPathname(pathname);
  const { triggerId } = useTriggerDetail();
  const { width, onResize, persist } = usePersistedTriggerDetailSidebarWidth(userId);
  const { rows, loading } = useTriggerSidebarList();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TriggerSidebarFilter>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Trigger | null>(null);
  const [deleting, setDeleting] = useState(false);

  const counts = useMemo(() => {
    return {
      all: rows.length,
      active: rows.filter((r) => r.status === "active").length,
      draft: rows.filter((r) => r.status === "draft").length,
      paused: rows.filter((r) => r.status === "paused").length,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...rows]
      .filter((row) => (filter === "all" ? true : row.status === filter))
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .filter((row) => {
        if (!q) return true;
        return (
          row.name.toLowerCase().includes(q) ||
          row.slug.includes(q) ||
          triggerSourceSummary(row.source).toLowerCase().includes(q)
        );
      });
  }, [rows, search, filter]);

  const onCreated = useCallback(
    (id: string) => {
      router.push(triggerDetailHref(id, "config"));
    },
    [router],
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await scaleApi.updateTrigger(deleteTarget.id, { listStatus: "archived" });
      removeTriggerSidebarListRow(deleteTarget.id);

      if (triggerId === deleteTarget.id) {
        const remaining = getTriggerSidebarListSnapshot()
          .filter((r) => r.id !== deleteTarget.id)
          .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
        if (remaining[0]) {
          router.replace(triggerDetailHref(remaining[0].id, currentTab));
        } else {
          router.replace(triggersPath);
        }
      }

      toast.success(`Deleted “${triggerRowLabel(deleteTarget)}”`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof ScaleApiError ? err.message : "Could not delete trigger");
    } finally {
      setDeleting(false);
    }
  }, [currentTab, deleteTarget, router, triggerId, triggersPath]);

  const aside = (
    <aside
      className="flex h-full shrink-0 flex-col border-r border-border bg-muted/20"
      style={{ width }}
      aria-label="Triggers"
    >
      <TriggerSidebarHeader addOpen={addOpen} setAddOpen={setAddOpen} onCreated={onCreated} />
      <div className="shrink-0 space-y-2 border-b border-border px-2.5 py-2">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search triggers…"
            autoComplete="off"
            className="h-8 border-border/60 bg-background pl-8 text-xs shadow-none"
          />
        </div>
        <div
          className="flex w-full flex-wrap gap-0.5 rounded-lg bg-muted p-0.5"
          role="tablist"
          aria-label="Filter triggers"
        >
          {SIDEBAR_FILTER_OPTIONS.map((opt) => {
            const selected = filter === opt.value;
            const count = counts[opt.value];
            return (
              <button
                key={opt.value}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setFilter(opt.value)}
                className={cn(
                  "inline-flex min-w-0 flex-1 items-center justify-center gap-1 rounded-md px-1.5 py-1 text-[10px] transition-colors",
                  selected
                    ? "bg-background font-medium text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span>{opt.label}</span>
                <span className="tabular-nums text-muted-foreground/70">{count}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {loading ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">No triggers</p>
        ) : filtered.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">No matching triggers</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {filtered.map((row) => (
              <TriggerSidebarRow
                key={row.id}
                row={row}
                active={row.id === triggerId}
                tab={currentTab}
                onRequestDelete={setDeleteTarget}
              />
            ))}
          </ul>
        )}
      </div>
    </aside>
  );

  return (
    <>
      <div className="flex h-full shrink-0 overflow-hidden" style={{ width: width + 4 }}>
        {aside}
        <PanelSplitHandle onResize={onResize} onResizeEnd={persist} />
      </div>

      <Dialog open={deleteTarget != null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete trigger?</DialogTitle>
            <DialogDescription>
              {deleteTarget ? (
                <>
                  <span className="font-medium text-foreground">{triggerRowLabel(deleteTarget)}</span>{" "}
                  will be removed from the list and sends will stop. You can create a new trigger
                  anytime.
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
    </>
  );
}

export const TriggerDetailSidebar = memo(TriggerDetailSidebarInner);
