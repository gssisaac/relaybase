"use client";

import Link from "next/link";

import { MessageLinkedOwnerBadge } from "@/studio/components/messages/MessageLinkedOwnerBadge";
import { MessageThumbnailPreview } from "@/studio/components/messages/MessageThumbnailPreview";
import { messagePreviewHref } from "@/studio/lib/message-paths";
import type { StudioLayout, StudioMessage } from "@/lib/studio/api";
import { cn } from "@/lib/utils";

export function resolveMessageLayout(
  message: StudioMessage,
  layouts: StudioLayout[],
): StudioLayout | null {
  const layoutId = message.layoutId ?? layouts[0]?.id;
  if (!layoutId) return null;
  return layouts.find((row) => row.id === layoutId) ?? null;
}

export function MessageThumbnailGrid({
  messages,
  layouts,
  className,
}: {
  messages: StudioMessage[];
  layouts: StudioLayout[];
  className?: string;
}) {
  return (
    <ul
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        className,
      )}
    >
      {messages.map((message) => {
        const layout = resolveMessageLayout(message, layouts);
        const href = messagePreviewHref(message.id);
        return (
          <li key={message.id}>
            <div className="group flex flex-col overflow-hidden rounded-lg border bg-card transition hover:border-primary/40 hover:shadow-sm">
              <Link href={href} className="flex min-w-0 flex-col outline-none">
                <MessageThumbnailPreview messageId={message.id} message={message} layout={layout} />
                <div className="space-y-1.5 border-t px-3 py-2.5">
                  <p className="truncate text-sm font-medium">{message.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {message.subject.trim() || "No subject"}
                  </p>
                </div>
              </Link>
              {message.linkedOwner ? (
                <div className="border-t px-3 py-2.5">
                  <MessageLinkedOwnerBadge owner={message.linkedOwner} className="max-w-full" />
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
