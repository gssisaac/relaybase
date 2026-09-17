"use client";

import { type ComponentProps } from "react";

import { MessageThumbnailPreview } from "@/studio/components/messages/MessageThumbnailPreview";
import type { Newsletter, StudioLayout } from "@/studio/api";

/**
 * Newsletter gallery thumbnails — same as Messages: IndexedDB cache + in-browser capture
 * via `useMessageThumbnailObjectUrl`. Cache key uses linked `messageId` when present so
 * previews match the Messages list for the same body.
 */
export function NewsletterThumbnailPreview({
  newsletterId,
  newsletter,
  layout,
  className,
  imageClassName,
}: {
  newsletterId: string;
  newsletter: Pick<
    Newsletter,
    "messageId" | "bodyMarkdown" | "layoutId" | "templateVariables" | "subject"
  >;
  layout: StudioLayout | null;
  className?: string;
  imageClassName?: string;
}) {
  const cacheId = newsletter.messageId?.trim() || newsletterId;

  return (
    <MessageThumbnailPreview
      messageId={cacheId}
      message={{
        bodyMarkdown: newsletter.bodyMarkdown,
        layoutId: newsletter.layoutId,
        templateVariables: newsletter.templateVariables,
        subject: newsletter.subject,
      }}
      layout={layout}
      className={className}
      imageClassName={imageClassName}
    />
  );
}

export type NewsletterThumbnailPreviewProps = ComponentProps<typeof NewsletterThumbnailPreview>;
