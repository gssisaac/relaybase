"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { memo, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { PanelSplitHandle } from "@/components/ui/panel-split-handle";
import { usePersistedAutomationDetailSidebarWidth } from "@/hooks/use-persisted-automation-detail-sidebar-width";
import { AutomationStatusBadge } from "@/scale/components/AutomationStatusBadge";
import {
  automationListRelativeDate,
  automationTriggerSummary,
} from "@/scale/lib/automation-trigger-label";
import { automationDetailHref, automationTabFromPathname, type AutomationDetailTab } from "@/scale/lib/paths";
import { useAutomationDetail } from "@/scale/pages/automations/AutomationDetailContext";
import { useAutomationSidebarList } from "@/scale/pages/automations/use-automation-sidebar-list";
import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import type { Automation } from "@/lib/scale/api";
import { cn } from "@/lib/utils";

const AutomationSidebarRow = memo(function AutomationSidebarRow({
  row,
  active,
  tab,
}: {
  row: Automation;
  active: boolean;
  tab: AutomationDetailTab;
}) {
  const label = row.name?.trim() || row.subject?.trim() || "Untitled automation";
  const href = automationDetailHref(row.id, tab);

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
            {automationListRelativeDate(row)}
          </span>
        </div>
        <AutomationStatusBadge
          status={row.status}
          listStatus={row.listStatus}
          className="w-fit shrink-0 whitespace-nowrap"
        />
      </Link>
    </li>
  );
});

function AutomationDetailSidebarInner() {
  const userId = useProductId();
  const pathname = usePathname();
  const currentTab = automationTabFromPathname(pathname);
  const { automationId } = useAutomationDetail();
  const { width, onResize, persist } = usePersistedAutomationDetailSidebarWidth(userId);
  const { rows, loading } = useAutomationSidebarList();
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
          automationTriggerSummary(row.trigger).toLowerCase().includes(q)
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
            placeholder="Search automations…"
            autoComplete="off"
            className="h-8 border-border/60 bg-background pl-8 text-xs shadow-none"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {loading ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">No automations</p>
        ) : filtered.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">No matching automations</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {filtered.map((row) => (
              <AutomationSidebarRow
                key={row.id}
                row={row}
                active={row.id === automationId}
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

export const AutomationDetailSidebar = memo(AutomationDetailSidebarInner);
