"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { messageFromSearch } from "@/studio/lib/message-paths";
import { MessagesBrowseView } from "@/studio/pages/messages/MessagesBrowseView";
import { MessagesListView } from "@/studio/pages/messages/MessagesListView";

function MessagesViewBody() {
  const searchParams = useSearchParams();
  const detail = messageFromSearch(searchParams);

  if (detail?.messageId) {
    return <MessagesBrowseView />;
  }

  return <MessagesListView />;
}

export function MessagesView() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading…</div>}>
      <MessagesViewBody />
    </Suspense>
  );
}
