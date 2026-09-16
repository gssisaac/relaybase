"use client";

import { LayoutTemplate, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { Button } from "@/components/ui/button";
import { MessageThumbnailGrid } from "@/studio/components/messages/MessageThumbnailGrid";
import { dashboardScrollBodyClassName } from "@/console/lib/page-layout";
import { ListToolbar } from "@/email/components/mailbox/EmailListShell";
import { messageDetailHref } from "@/studio/lib/message-paths";
import { useStudioPaths } from "@/studio/lib/paths";
import { NewMessageDialog } from "@/studio/pages/messages/NewMessageDialog";
import { studioApi, type StudioLayout, type StudioMessage } from "@/lib/studio/api";
import { cn } from "@/lib/utils";

export function MessagesListView() {
  const router = useRouter();
  const { layouts: layoutsPath, templates: templatesPath } = useStudioPaths();
  const [messages, setMessages] = useState<StudioMessage[]>([]);
  const [layouts, setLayouts] = useState<StudioLayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async (force?: boolean) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    try {
      const [messageRes, layoutRes] = await Promise.all([
        studioApi.listMessages(),
        studioApi.listLayouts(),
      ]);
      setMessages(messageRes.messages);
      setLayouts(layoutRes.layouts);
    } catch {
      toast.error("Could not load messages");
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
    const sorted = [...messages].sort(
      (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
    );
    if (!q) return sorted;
    return sorted.filter(
      (row) =>
        row.name.toLowerCase().includes(q) ||
        row.subject.toLowerCase().includes(q) ||
        row.id.toLowerCase().includes(q),
    );
  }, [messages, search]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <DesktopTitleBar
        className="px-4 py-3"
        end={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" nativeButton={false} render={<Link href={templatesPath} />}>
              Templates
            </Button>
            <Button size="sm" variant="outline" nativeButton={false} render={<Link href={layoutsPath} />}>
              <LayoutTemplate className="size-4" />
              Layouts
            </Button>
            <NewMessageDialog
              open={addOpen}
              onOpenChange={setAddOpen}
              onCreated={(messageId) => router.push(messageDetailHref(messageId))}
              trigger={
                <Button size="sm">
                  <Plus className="size-4" />
                  New message
                </Button>
              }
            />
            <Button
              variant="outline"
              size="sm"
              disabled={refreshing || loading}
              onClick={() => void load(true)}
            >
              <RefreshCw className={cn("size-4", refreshing && "animate-spin")} aria-hidden />
            </Button>
          </div>
        }
      >
        <div className="min-w-0 space-y-1">
          <h1 className="truncate text-lg font-semibold tracking-tight">Messages</h1>
          <p className="text-sm text-muted-foreground">
            Saved copies plus message bodies linked to triggers and newsletters.
          </p>
        </div>
      </DesktopTitleBar>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
        <div className={dashboardScrollBodyClassName("space-y-4")}>
          <ListToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search messages…" />

          {loading && messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading messages…</p>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-sm text-muted-foreground">
                {search.trim()
                  ? "No messages match your search."
                  : "No saved messages yet — create one or use a template."}
              </p>
              {!search.trim() ? (
                <Button size="sm" onClick={() => setAddOpen(true)}>
                  <Plus className="size-4" />
                  New message
                </Button>
              ) : null}
            </div>
          ) : (
            <MessageThumbnailGrid messages={filtered} layouts={layouts} />
          )}
        </div>
      </div>
    </div>
  );
}
