"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { memo, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { PanelSplitHandle } from "@/components/ui/panel-split-handle";
import { usePersistedTriggerDetailSidebarWidth } from "@/hooks/use-persisted-trigger-detail-sidebar-width";
import { TriggerStatusBadge } from "@/scale/components/triggers/TriggerStatusBadge";
import {
  triggerListRelativeDate,
  triggerSourceSummary,
} from "@/scale/lib/triggers/trigger-label";
import { triggerDetailHref, triggerTabFromPathname, type TriggerDetailTab } from "@/scale/lib/paths";
import { useTriggerDetail } from "@/scale/pages/triggers/TriggerDetailContext";
import { useTriggerSidebarList } from "@/scale/pages/triggers/use-trigger-sidebar-list";
import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import type { Trigger } from "@/lib/scale/api";
import { cn } from "@/lib/utils";

const TriggerSidebarRow = memo(function TriggerSidebarRow({
  row,
  active,
  tab,
}: {
  row: Trigger;
  active: boolean;
  tab: TriggerDetailTab;
}) {
  const label = row.name?.trim() || row.subject?.trim() || "Untitled trigger";
  const href = triggerDetailHref(row.id, tab);

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
            {triggerListRelativeDate(row)}
          </span>
        </div>
        <TriggerStatusBadge
          status={row.status}
          listStatus={row.listStatus}
          className="w-fit shrink-0 whitespace-nowrap"
        />
      </Link>
    </li>
  );
});

function TriggerDetailSidebarInner() {
  const userId = useProductId();
  const pathname = usePathname();
  const currentTab = triggerTabFromPathname(pathname);
  const { triggerId } = useTriggerDetail();
  const { width, onResize, persist } = usePersistedTriggerDetailSidebarWidth(userId);
  const { rows, loading } = useTriggerSidebarList();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...rows]
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .filter((row) => {
        if (!q) return true;
        return (
          row.name.toLowerCase().includes(q) ||
          row.slug.includes(q) ||
          triggerSourceSummary(row.source).toLowerCase().includes(q)
        );
      });
  }, [rows, search]);

  const aside = (
    <aside
      className="flex h-full shrink-0 flex-col border-r border-border bg-muted/20"
      style={{ width }}
      aria-label="Automations"
    >
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
            placeholder="Search triggers…"
            autoComplete="off"
            className="h-8 border-border/60 bg-background pl-8 text-xs shadow-none"
          />
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

export const TriggerDetailSidebar = memo(TriggerDetailSidebarInner);
