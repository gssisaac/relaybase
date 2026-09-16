"use client";

import { useMemo } from "react";

import { LAYOUT_PREVIEW_FIXTURES } from "@/scale/lib/layouts/layout-preview-sample-values";
import { isPlainTextTemplate } from "@/scale/lib/layouts/layout-catalog";
import { renderLayoutPreviewHtml } from "@/scale/lib/layouts/render-layout-preview-html";
import type { TemplateVariablesSchema } from "@/scale/lib/layouts/layout-template-variables";

export function useLayoutRenderedPreview({
  layoutId,
  htmlSource,
  variablesSchema,
}: {
  layoutId: string;
  htmlSource: string;
  variablesSchema: TemplateVariablesSchema | null | undefined;
}) {
  const plainTextTemplate = isPlainTextTemplate(layoutId);

  const renderedPreview = useMemo(
    () =>
      renderLayoutPreviewHtml({
        layoutId,
        htmlSource,
        variablesSchema,
      }),
    [htmlSource, layoutId, variablesSchema],
  );

  return {
    plainTextTemplate,
    renderedPreview,
    previewRecipientEmail: LAYOUT_PREVIEW_FIXTURES.contactEmail,
    previewFromEmail: LAYOUT_PREVIEW_FIXTURES.fromEmail,
  };
}
