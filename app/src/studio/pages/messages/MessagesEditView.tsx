"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { messageFromSearch } from "@/studio/lib/message-paths";
import { useStudioPaths } from "@/studio/lib/paths";
import { MessageDetailView } from "@/studio/pages/messages/MessageDetailView";

function MessagesEditRoute() {
  const router = useRouter();
  const { messages: messagesPath } = useStudioPaths();
  const searchParams = useSearchParams();
  const detail = messageFromSearch(searchParams);

  useEffect(() => {
    if (!detail) {
      router.replace(messagesPath);
    }
  }, [detail, router, messagesPath]);

  if (!detail) {
    return <div className="p-4 text-sm text-muted-foreground">Loading…</div>;
  }

  return <MessageDetailView messageId={detail.messageId} />;
}

export function MessagesEditView() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading…</div>}>
      <MessagesEditRoute />
    </Suspense>
  );
}
