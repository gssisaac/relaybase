"use client";

import { useEffect, useRef, useState } from "react";

import { captureLayoutThumbnailBlob } from "@/studio/lib/layouts/capture-layout-thumbnail-client";
import {
  layoutThumbnailCacheKey,
  readCachedLayoutThumbnail,
  writeCachedLayoutThumbnail,
} from "@/studio/lib/layouts/layout-thumbnail-cache";
import type { TemplateVariablesSchema } from "@/studio/lib/layouts/layout-template-variables";

const inflight = new Map<string, Promise<Blob>>();

async function loadOrCaptureThumbnail(input: {
  layoutId: string;
  htmlSource: string;
  variablesSchema: TemplateVariablesSchema | null | undefined;
}): Promise<Blob> {
  const cacheKey = await layoutThumbnailCacheKey(
    input.layoutId,
    input.htmlSource,
    input.variablesSchema,
  );
  const cached = await readCachedLayoutThumbnail(cacheKey);
  if (cached) return cached;

  let pending = inflight.get(cacheKey);
  if (!pending) {
    pending = captureLayoutThumbnailBlob(input).finally(() => {
      inflight.delete(cacheKey);
    });
    inflight.set(cacheKey, pending);
  }

  const blob = await pending;
  void writeCachedLayoutThumbnail(cacheKey, blob);
  return blob;
}

export function useLayoutThumbnailObjectUrl(input: {
  layoutId: string;
  htmlSource: string;
  variablesSchema: TemplateVariablesSchema | null | undefined;
  enabled: boolean;
}): { objectUrl: string | null; failed: boolean } {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const objectUrlRef = useRef<string | null>(null);
  const variablesSchemaKey = input.variablesSchema
    ? JSON.stringify(input.variablesSchema)
    : "";

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
    void loadOrCaptureThumbnail({
      layoutId: input.layoutId,
      htmlSource: input.htmlSource,
      variablesSchema: input.variablesSchema,
    })
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        const prev = objectUrlRef.current;
        if (prev) URL.revokeObjectURL(prev);
        setObjectUrl(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        /* loading state omitted — wireframe shows until objectUrl is ready */
      });

    return () => {
      cancelled = true;
    };
  }, [input.enabled, input.layoutId, input.htmlSource, variablesSchemaKey]);

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    [],
  );

  return { objectUrl, failed };
}
