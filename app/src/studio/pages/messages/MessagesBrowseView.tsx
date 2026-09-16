"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { dashboardScrollBodyClassName } from "@/console/lib/page-layout";
import { messageFromSearch, messagePreviewHref } from "@/studio/lib/message-paths";
import { MessageBrowseSidebarEmpty } from "@/studio/pages/messages/MessageDetailSidebar";
import {
  MessageDetailProvider,
  useMessageDetail,
} from "@/studio/pages/messages/MessageDetailContext";
import { MessagePreviewShell } from "@/studio/pages/messages/MessagePreviewShell";
import { MessagePreviewView } from "@/studio/pages/messages/MessagePreviewView";
import { MessageSidebarNewProvider } from "@/studio/pages/messages/MessageSidebarNewContext";
import { invalidateMessageSidebarList } from "@/studio/lib/messages/message-sidebar-list";
import { useMessageSidebarList } from "@/studio/pages/messages/use-message-sidebar-list";

function pickDefaultMessageId(rows: { id: string; updatedAt: string }[]): string | null {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  return sorted[0]?.id ?? null;
}

function MessagePreviewBody() {
  const { message, loading, notFound } = useMessageDetail();

  if (loading && !message) {
    return (
      <div className={dashboardScrollBodyClassName("text-sm text-muted-foreground")}>
        Loading message…
      </div>
    );
  }

  if (notFound || !message) {
    return (
      <div className={dashboardScrollBodyClassName("text-sm text-muted-foreground")}>
        This message does not exist or was removed.
      </div>
    );
  }

  return <MessagePreviewView />;
}

function MessageBrowseWithSelection({ messageId }: { messageId: string }) {
  return (
    <MessageDetailProvider key={messageId} messageId={messageId}>
      <MessagePreviewShell>
        <MessagePreviewBody />
      </MessagePreviewShell>
    </MessageDetailProvider>
  );
}

function MessagesBrowseEmptyContent() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
      <MessageBrowseSidebarEmpty />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <DesktopTitleBar className="px-4 py-3">
          <h1 className="truncate text-sm font-semibold tracking-tight text-muted-foreground">
            Preview
          </h1>
        </DesktopTitleBar>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-6">
          <p className="text-sm text-muted-foreground">No messages yet</p>
        </div>
      </div>
    </div>
  );
}

function MessagesBrowseInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { rows, loading, refresh } = useMessageSidebarList();

  useEffect(() => {
    invalidateMessageSidebarList();
    void refresh(true);
  }, [refresh]);

  const detail = messageFromSearch(searchParams);

  const resolvedId = useMemo(() => {
    if (detail?.messageId) return detail.messageId;
    return pickDefaultMessageId(rows);
  }, [detail?.messageId, rows]);

  useEffect(() => {
    if (loading || rows.length === 0) return;
    const fromQuery = detail?.messageId?.trim() ?? "";
    if (fromQuery) return;
    const firstId = pickDefaultMessageId(rows);
    if (firstId) {
      router.replace(messagePreviewHref(firstId));
    }
  }, [loading, rows, detail?.messageId, router]);

  if (loading && rows.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
        Loading messages…
      </div>
    );
  }

  if (rows.length === 0 || !resolvedId) {
    return <MessagesBrowseEmptyContent />;
  }

  return <MessageBrowseWithSelection messageId={resolvedId} />;
}

export function MessagesBrowseView() {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);

  const onCreated = useCallback(
    (messageId: string) => {
      router.push(messagePreviewHref(messageId));
    },
    [router],
  );

  return (
    <MessageSidebarNewProvider addOpen={addOpen} setAddOpen={setAddOpen} onCreated={onCreated}>
      <MessagesBrowseInner />
    </MessageSidebarNewProvider>
  );
}
