"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";

import {
  LayoutWireframe,
  type LayoutWireframeVariant,
} from "@/scale/components/layouts/LayoutWireframe";
import { resolveLayoutThumbnailPublicPath } from "@/scale/lib/layouts/layout-thumbnail-paths";
import type { TemplateVariablesSchema } from "@/scale/lib/layouts/layout-template-variables";
import { useLayoutThumbnailObjectUrl } from "@/scale/lib/layouts/use-layout-thumbnail-object-url";
import { cn } from "@/lib/utils";

export function LayoutThumbnailPreview({
  layoutId,
  isBuiltin,
  htmlSource,
  variablesSchema,
  variant,
  className,
  imageClassName,
}: {
  layoutId: string;
  isBuiltin: boolean;
  htmlSource?: string;
  variablesSchema?: TemplateVariablesSchema | null;
  variant: LayoutWireframeVariant;
  className?: string;
  imageClassName?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [staticFailed, setStaticFailed] = useState(false);

  const staticSrc = resolveLayoutThumbnailPublicPath({ layoutId, isBuiltin });
  const canCaptureCustom = !isBuiltin && Boolean(htmlSource?.trim());

  useEffect(() => {
    if (!canCaptureCustom) return;
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
  }, [canCaptureCustom]);

  const { objectUrl, failed: captureFailed } = useLayoutThumbnailObjectUrl({
    layoutId,
    htmlSource: htmlSource ?? "",
    variablesSchema: variablesSchema ?? null,
    enabled: canCaptureCustom && inView,
  });

  const imageClass = cn("aspect-[640/452] w-full object-cover object-top", imageClassName);

  if (isBuiltin && staticSrc && !staticFailed) {
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

  if (canCaptureCustom && objectUrl && !captureFailed) {
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
      <LayoutWireframe variant={variant} className={className} />
    </div>
  );
}

export type LayoutThumbnailPreviewProps = ComponentProps<typeof LayoutThumbnailPreview>;
