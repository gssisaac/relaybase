"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";

import { TemplateWireframe } from "@/studio/components/templates/TemplateWireframe";
import { resolveMessageTemplateThumbnailPublicPath } from "@/studio/lib/templates/message-template-thumbnail-paths";
import { useMessageTemplateThumbnailObjectUrl } from "@/studio/lib/templates/use-message-template-thumbnail-object-url";
import type { StudioLayout, StudioTemplate } from "@/lib/studio/api";
import { cn } from "@/lib/utils";

export function TemplateThumbnailPreview({
  templateId,
  template,
  layout,
  isPreset,
  className,
  imageClassName,
}: {
  templateId: string;
  template: Pick<StudioTemplate, "bodyMarkdown" | "layoutId" | "templateVariables" | "subject">;
  layout: StudioLayout | null;
  isPreset: boolean;
  className?: string;
  imageClassName?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [staticFailed, setStaticFailed] = useState(false);

  const staticSrc = resolveMessageTemplateThumbnailPublicPath({ templateId, isPreset });
  const shouldCapture = !isPreset || staticFailed || !staticSrc;

  useEffect(() => {
    if (!shouldCapture) return;
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
  }, [shouldCapture]);

  const { objectUrl, failed: captureFailed } = useMessageTemplateThumbnailObjectUrl({
    templateId,
    template,
    layout,
    enabled: shouldCapture && inView,
  });

  const imageClass = cn("aspect-[640/452] w-full object-cover object-top", imageClassName);

  if (isPreset && staticSrc && !staticFailed) {
    return (
      <div
        ref={rootRef}
        className={cn(
          "overflow-hidden rounded border border-border/80 bg-muted/20",
          className,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={staticSrc}
          alt=""
          className={imageClass}
          loading="lazy"
          onError={() => setStaticFailed(true)}
        />
      </div>
    );
  }

  if (shouldCapture && objectUrl && !captureFailed) {
    return (
      <div
        ref={rootRef}
        className={cn(
          "overflow-hidden rounded border border-border/80 bg-muted/20",
          className,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={objectUrl} alt="" className={imageClass} />
      </div>
    );
  }

  return (
    <div ref={rootRef}>
      <TemplateWireframe className={className} />
    </div>
  );
}

export type TemplateThumbnailPreviewProps = ComponentProps<typeof TemplateThumbnailPreview>;
