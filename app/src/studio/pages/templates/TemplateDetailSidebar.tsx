"use client";

import { LayoutTemplate, MoreHorizontal, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { usePersistedTemplateDetailSidebarWidth } from "@/hooks/use-persisted-template-detail-sidebar-width";
import { studioApi, StudioApiError, type MessageTemplate } from "@/lib/studio/api";
import { useStudioPaths } from "@/studio/lib/paths";
import { messageTemplatePreviewHref } from "@/studio/lib/template-paths";
import {
  getTemplateSidebarListSnapshot,
  removeTemplateSidebarListRow,
} from "@/studio/lib/templates/template-sidebar-list";
import { NewTemplateDialog } from "@/studio/pages/templates/NewTemplateDialog";
import { useTemplateSidebarNew } from "@/studio/pages/templates/TemplateSidebarNewContext";
import { useTemplateDetail } from "@/studio/pages/templates/TemplateDetailContext";
import { useTemplateSidebarList } from "@/studio/pages/templates/use-template-sidebar-list";
import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import { cn } from "@/lib/utils";

function templateListRelativeDate(row: MessageTemplate): string {
  const ms = Date.parse(row.updatedAt);
  if (!Number.isFinite(ms)) return "";
  const diff = Date.now() - ms;
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days < 1) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d`;
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function templateRowLabel(row: MessageTemplate): string {
  return row.name?.trim() || row.subject?.trim() || "Untitled template";
}

function TemplateSidebarDeleteActions({
  onDelete,
}: {
  onDelete: () => void;
}) {
  return (
    <>
      <DropdownMenuItem variant="destructive" onClick={onDelete}>
        <Trash2 className="size-4" />
        Delete template
      </DropdownMenuItem>
    </>
  );
}

const TemplateSidebarRow = memo(function TemplateSidebarRow({
  row,
  active,
  onRequestDelete,
}: {
  row: MessageTemplate;
  active: boolean;
  onRequestDelete: (row: MessageTemplate) => void;
}) {
  const label = templateRowLabel(row);
  const href = messageTemplatePreviewHref(row.id);
  const deletable = !row.isPreset;

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
          <span
            className={cn(
              "shrink-0 text-[10px] tabular-nums text-muted-foreground",
              deletable && "group-hover/sidebar-row:invisible",
            )}
          >
            {templateListRelativeDate(row)}
          </span>
        </div>
        {row.subject.trim() ? (
          <span className="truncate text-[10px] text-muted-foreground">{row.subject}</span>
        ) : null}
      </Link>
      {deletable ? (
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
              <TemplateSidebarDeleteActions onDelete={() => onRequestDelete(row)} />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}
    </div>
  );

  if (!deletable) {
    return (
      <li className="group/sidebar-row">
        {rowBody}
      </li>
    );
  }

  return (
    <li className="group/sidebar-row">
      <ContextMenu>
        <ContextMenuTrigger render={<div className="contents" />}>{rowBody}</ContextMenuTrigger>
        <ContextMenuContent className="min-w-44">
          <ContextMenuItem variant="destructive" onClick={() => onRequestDelete(row)}>
            <Trash2 className="size-4" />
            Delete template
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </li>
  );
});

function TemplateSidebarHeader() {
  const newTemplate = useTemplateSidebarNew();

  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-2.5 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <LayoutTemplate className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="truncate text-xs font-semibold tracking-tight">Templates</span>
      </div>
      {newTemplate ? (
        <NewTemplateDialog
          open={newTemplate.addOpen}
          onOpenChange={newTemplate.setAddOpen}
          onCreated={newTemplate.onCreated}
          trigger={
            <Button type="button" size="icon-sm" variant="ghost" aria-label="New template">
              <Plus className="size-4" />
            </Button>
          }
        />
      ) : null}
    </div>
  );
}

function TemplateListSidebarInner({ activeTemplateId }: { activeTemplateId: string | null }) {
  const router = useRouter();
  const { templates: templatesPath } = useStudioPaths();
  const userId = useProductId();
  const { width, onResize, persist } = usePersistedTemplateDetailSidebarWidth(userId);
  const { rows, loading } = useTemplateSidebarList();
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<MessageTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...rows]
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .filter((row) => {
        if (!q) return true;
        return (
          row.name.toLowerCase().includes(q) ||
          row.subject.toLowerCase().includes(q) ||
          row.id.toLowerCase().includes(q)
        );
      });
  }, [rows, search]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget || deleteTarget.isPreset) return;
    setDeleting(true);
    try {
      await studioApi.deleteMessageTemplate(deleteTarget.id);
      removeTemplateSidebarListRow(deleteTarget.id);

      if (activeTemplateId === deleteTarget.id) {
        const remaining = getTemplateSidebarListSnapshot()
          .filter((r) => r.id !== deleteTarget.id)
          .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
        if (remaining[0]) {
          router.replace(messageTemplatePreviewHref(remaining[0].id));
        } else {
          router.replace(templatesPath);
        }
      }

      toast.success(`Deleted “${templateRowLabel(deleteTarget)}”`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof StudioApiError ? err.message : "Could not delete template");
    } finally {
      setDeleting(false);
    }
  }, [activeTemplateId, deleteTarget, router, templatesPath]);

  const aside = (
    <aside
      className="flex h-full shrink-0 flex-col border-r border-border bg-muted/20"
      style={{ width }}
      aria-label="Templates"
    >
      <TemplateSidebarHeader />
      <div className="shrink-0 border-b border-border px-2.5 py-2">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates…"
            autoComplete="off"
            className="h-8 border-border/60 bg-background pl-8 text-xs shadow-none"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {loading ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">No templates</p>
        ) : filtered.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">No matching templates</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {filtered.map((row) => (
              <TemplateSidebarRow
                key={row.id}
                row={row}
                active={activeTemplateId != null && row.id === activeTemplateId}
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
            <DialogTitle>Delete template?</DialogTitle>
            <DialogDescription>
              {deleteTarget ? (
                <>
                  <span className="font-medium text-foreground">{templateRowLabel(deleteTarget)}</span>{" "}
                  will be removed permanently. Newsletters and triggers that already used this template
                  are not affected.
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

function TemplateDetailSidebarInner() {
  const { messageTemplateId } = useTemplateDetail();
  return <TemplateListSidebarInner activeTemplateId={messageTemplateId} />;
}

export const TemplateDetailSidebar = memo(TemplateDetailSidebarInner);

export const TemplateBrowseSidebarEmpty = memo(function TemplateBrowseSidebarEmpty() {
  return <TemplateListSidebarInner activeTemplateId={null} />;
});
