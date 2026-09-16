"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";

import { TemplateWireframe } from "@/studio/components/templates/TemplateWireframe";
import { useMessageThumbnailObjectUrl } from "@/studio/lib/messages/use-message-thumbnail-object-url";
import type { StudioLayout, StudioMessage } from "@/lib/studio/api";
import { cn } from "@/lib/utils";

/**
 * Message gallery thumbnails — always captured in-browser (like custom layouts),
 * with IndexedDB cache via useMessageThumbnailObjectUrl.
 */
export function MessageThumbnailPreview({
  messageId,
  message,
  layout,
  className,
  imageClassName,
}: {
  messageId: string;
  message: Pick<StudioMessage, "bodyMarkdown" | "layoutId" | "templateVariables" | "subject">;
  layout: StudioLayout | null;
  className?: string;
  imageClassName?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setInView(true);
      },
      { rootMargin: "120px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { objectUrl, failed: captureFailed } = useMessageThumbnailObjectUrl({
    templateId: messageId,
    template: message,
    layout,
    enabled: inView,
  });

  const imageClass = cn("aspect-[640/452] w-full object-cover object-top", imageClassName);

  if (objectUrl && !captureFailed) {
    return (
      <div
        ref={rootRef}
        className={cn(
          "overflow-hidden rounded border border-border/80 bg-muted/20",
          className,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={objectUrl} alt="" className={imageClass} loading="lazy" />
      </div>
    );
  }

  return (
    <div ref={rootRef}>
      <TemplateWireframe className={className} />
    </div>
  );
}

export type MessageThumbnailPreviewProps = ComponentProps<typeof MessageThumbnailPreview>;
