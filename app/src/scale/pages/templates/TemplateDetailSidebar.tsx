"use client";

import { LayoutTemplate, Plus, Search } from "lucide-react";
import Link from "next/link";
import { memo, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PanelSplitHandle } from "@/components/ui/panel-split-handle";
import { usePersistedTemplateDetailSidebarWidth } from "@/hooks/use-persisted-template-detail-sidebar-width";
import { messageTemplatePreviewHref } from "@/scale/lib/template-paths";
import { NewTemplateDialog } from "@/scale/pages/templates/NewTemplateDialog";
import { useTemplateSidebarNew } from "@/scale/pages/templates/TemplateSidebarNewContext";
import { useTemplateDetail } from "@/scale/pages/templates/TemplateDetailContext";
import { useTemplateSidebarList } from "@/scale/pages/templates/use-template-sidebar-list";
import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import type { MessageTemplate } from "@/lib/scale/api";
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

const TemplateSidebarRow = memo(function TemplateSidebarRow({
  row,
  active,
}: {
  row: MessageTemplate;
  active: boolean;
}) {
  const label = row.name?.trim() || row.subject?.trim() || "Untitled template";
  const href = messageTemplatePreviewHref(row.id);

  return (
    <li>
      <Link
        href={href}
        className={cn(
          "flex min-w-0 flex-col gap-1 rounded-md px-2.5 py-2 text-left transition-colors",
          active
            ? "bg-accent text-accent-foreground"
            : "text-foreground hover:bg-accent/60",
        )}
        aria-current={active ? "page" : undefined}
      >
        <div className="flex min-w-0 items-baseline justify-between gap-2">
          <span className="min-w-0 flex-1 truncate text-xs font-medium">{label}</span>
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
            {templateListRelativeDate(row)}
          </span>
        </div>
        {row.subject.trim() ? (
          <span className="truncate text-[10px] text-muted-foreground">{row.subject}</span>
        ) : null}
      </Link>
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
  const userId = useProductId();
  const { width, onResize, persist } = usePersistedTemplateDetailSidebarWidth(userId);
  const { rows, loading } = useTemplateSidebarList();
  const [search, setSearch] = useState("");

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
              />
            ))}
          </ul>
        )}
      </div>
    </aside>
  );

  return (
    <div className="flex h-full shrink-0 overflow-hidden" style={{ width: width + 4 }}>
      {aside}
      <PanelSplitHandle onResize={onResize} onResizeEnd={persist} />
    </div>
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
