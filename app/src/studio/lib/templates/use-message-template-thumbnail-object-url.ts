"use client";

import { useEffect, useRef, useState } from "react";

import type { StudioMessage, StudioLayout } from "@/studio/api";

import { captureMessageTemplateThumbnailBlob } from "./capture-message-template-thumbnail-client";
import {
  messageTemplateThumbnailCacheKey,
  readCachedMessageTemplateThumbnail,
  writeCachedMessageTemplateThumbnail,
} from "./message-template-thumbnail-cache";

const inflight = new Map<string, Promise<Blob>>();

async function loadOrCaptureThumbnail(input: {
  templateId: string;
  template: Pick<StudioMessage, "bodyMarkdown" | "layoutId" | "templateVariables" | "subject">;
  layout: StudioLayout | null;
}): Promise<Blob> {
  const layoutId = input.layout?.id ?? input.template.layoutId ?? "";
  const cacheKey = await messageTemplateThumbnailCacheKey({
    templateId: input.templateId,
    template: input.template,
    layoutId,
    layoutHtmlSource: input.layout?.htmlSource ?? "",
    variablesSchema: input.layout?.variablesSchema,
  });
  const cached = await readCachedMessageTemplateThumbnail(cacheKey);
  if (cached) return cached;

  let pending = inflight.get(cacheKey);
  if (!pending) {
    pending = captureMessageTemplateThumbnailBlob(input).finally(() => {
      inflight.delete(cacheKey);
    });
    inflight.set(cacheKey, pending);
  }

  const blob = await pending;
  void writeCachedMessageTemplateThumbnail(cacheKey, blob);
  return blob;
}

export function useMessageTemplateThumbnailObjectUrl(input: {
  templateId: string;
  template: Pick<StudioMessage, "bodyMarkdown" | "layoutId" | "templateVariables" | "subject">;
  layout: StudioLayout | null;
  enabled: boolean;
}): { objectUrl: string | null; failed: boolean } {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  const templateKey = JSON.stringify({
    body: input.template.bodyMarkdown,
    layoutId: input.template.layoutId,
    vars: input.template.templateVariables,
    subject: input.template.subject,
    layoutHtml: input.layout?.htmlSource ?? "",
  });

  useEffect(() => {
    objectUrlRef.current = objectUrl;
  }, [objectUrl]);

  useEffect(() => {
    if (!input.enabled) return;

    let cancelled = false;
    setFailed(false);
    setObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    void loadOrCaptureThumbnail(input)
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        const prev = objectUrlRef.current;
        if (prev) URL.revokeObjectURL(prev);
        setObjectUrl(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [input.enabled, input.templateId, templateKey]);

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    [],
  );

  return { objectUrl, failed };
}
