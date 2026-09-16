"use client";

import { Layers, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { Button } from "@/components/ui/button";
import { LayoutImportDialog } from "@/studio/components/layouts/LayoutImportDialog";
import { LayoutThumbnailPreview } from "@/studio/components/layouts/LayoutThumbnailPreview";
import { templateThumbnailVariant } from "@/studio/lib/newsletters/newsletter-merge-tags";
import { isPlainTextTemplate } from "@/studio/lib/layouts/layout-catalog";
import { layoutDetailHref } from "@/studio/lib/layout-paths";
import { dashboardScrollBodyClassName } from "@/console/lib/page-layout";
import { studioApi, type StudioLayout } from "@/lib/studio/api";
import { cn } from "@/lib/utils";
import { ListToolbar } from "@/email/components/mailbox/EmailListShell";

export function LayoutsListView() {
  const router = useRouter();
  const [rows, setRows] = useState<StudioLayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);

  const load = useCallback(async (force?: boolean) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    try {
      const { layouts } = await studioApi.listLayouts();
      setRows(layouts);
    } catch {
      toast.error("Could not load layouts");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (t) => t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const builtins = filtered.filter((t) => t.isBuiltin);
  const custom = filtered.filter((t) => !t.isBuiltin);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <DesktopTitleBar
        className="px-4 py-3"
        end={
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setImportOpen(true)}>
              <Plus className="size-4" />
              Import HTML
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={refreshing || loading}
              onClick={() => void load(true)}
            >
              <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
            </Button>
          </div>
        }
      >
        <div className="min-w-0 space-y-1">
          <h1 className="truncate text-lg font-semibold tracking-tight">Layouts</h1>
          <p className="text-sm text-muted-foreground">
            HTML email frames with {"{{content}}"} — message copy lives in Templates.
          </p>
        </div>
      </DesktopTitleBar>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
        <div className={dashboardScrollBodyClassName("space-y-6")}>
          <ListToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search layouts…"
          />

          {loading && rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading layouts…</p>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <Layers className="size-10 text-muted-foreground/50" aria-hidden />
              <p className="text-sm text-muted-foreground">No layouts match your search.</p>
              <Button size="sm" onClick={() => setImportOpen(true)}>
                Import HTML layout
              </Button>
            </div>
          ) : (
            <>
              {custom.length ? (
                <section className="space-y-3">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Custom
                  </h2>
                  <LayoutCardGrid
                    layouts={custom}
                    onSelect={(id) => router.push(layoutDetailHref(id))}
                  />
                </section>
              ) : null}
              {builtins.length ? (
                <section className="space-y-3">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Built-in
                  </h2>
                  <LayoutCardGrid
                    layouts={builtins}
                    onSelect={(id) => router.push(layoutDetailHref(id))}
                  />
                </section>
              ) : null}
            </>
          )}
        </div>
      </div>

      <LayoutImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={(id) => {
          void load(true);
          router.push(layoutDetailHref(id));
        }}
      />
    </div>
  );
}

function LayoutCardGrid({
  layouts,
  onSelect,
}: {
  layouts: StudioLayout[];
  onSelect: (id: string) => void;
}) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {layouts.map((t) => {
        const variant = templateThumbnailVariant(t.id, t.derivedFromLayoutId);
        return (
          <li key={t.id}>
            <Link
              href={layoutDetailHref(t.id)}
              className={cn(
                "flex h-full flex-col rounded-lg border border-border bg-card p-3 text-left",
                "transition-colors hover:border-primary/40 hover:bg-muted/30",
              )}
              onClick={(e) => {
                e.preventDefault();
                onSelect(t.id);
              }}
            >
              <LayoutThumbnailPreview
                layoutId={t.id}
                isBuiltin={t.isBuiltin}
                htmlSource={t.htmlSource}
                variablesSchema={t.variablesSchema}
                variant={variant}
                className="mb-3"
              />
              <span className="text-sm font-medium leading-snug">{t.name}</span>
              <span className="mt-1 block text-[10px] text-muted-foreground">
                {t.isBuiltin
                  ? isPlainTextTemplate(t.id)
                    ? "Built-in · plain text"
                    : "Built-in · 600px max width"
                  : "Custom import"}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
