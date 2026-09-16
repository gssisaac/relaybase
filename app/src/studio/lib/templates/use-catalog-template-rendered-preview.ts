"use client";

import type { StudioLayout, StudioTemplate } from "@/lib/studio/api";
import { useMessageRenderedPreview } from "@/studio/pages/messages/use-message-rendered-preview";

export function useCatalogTemplateRenderedPreview(input: {
  template: StudioTemplate | null;
  layouts: StudioLayout[];
  previewHtml: string;
}) {
  const template = input.template;
  return useMessageRenderedPreview({
    messageId: template?.id ?? "catalog-preview",
    layouts: input.layouts,
    subject: template?.subject ?? "",
    bodyMarkdown: template?.bodyMarkdown ?? "",
    previewHtml: input.previewHtml,
    templateId: template?.layoutId ?? input.layouts[0]?.id ?? "",
    templateVariables: template?.templateVariables ?? {},
  });
}
