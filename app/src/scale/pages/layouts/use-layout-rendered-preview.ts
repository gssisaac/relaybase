"use client";

import { useMemo } from "react";

import {
  hardcodedLayoutTemplateVariables,
  layoutPreviewContentAsHtml,
  LAYOUT_PREVIEW_FIXTURES,
} from "@/scale/lib/layouts/layout-preview-sample-values";
import {
  applyTemplateVariablesToHtml,
  type TemplateVariablesSchema,
} from "@/scale/lib/layouts/layout-template-variables";
import { prepareLayoutTemplateHtml } from "@/scale/lib/layouts/layout-standard-footer";
import { isPlainTextTemplate } from "@/scale/lib/layouts/layout-catalog";
import { applyNewsletterMergeTags } from "@/scale/lib/newsletters/newsletter-merge-tags";

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

  const renderedPreview = useMemo(() => {
    const shell = prepareLayoutTemplateHtml(htmlSource, layoutId);
    const templateVariables = hardcodedLayoutTemplateVariables(variablesSchema);
    const withVars = applyTemplateVariablesToHtml(shell, variablesSchema, templateVariables);
    const sampleBody = plainTextTemplate
      ? LAYOUT_PREVIEW_FIXTURES.contentBody
      : layoutPreviewContentAsHtml(LAYOUT_PREVIEW_FIXTURES.contentBody);
    const wrapped = withVars.replaceAll("{{content}}", sampleBody);
    return applyNewsletterMergeTags(
      wrapped,
      {
        email: LAYOUT_PREVIEW_FIXTURES.contactEmail,
        name: LAYOUT_PREVIEW_FIXTURES.contactName,
      },
      {
        unsubscribeUrl: LAYOUT_PREVIEW_FIXTURES.unsubscribeUrl,
        compliance: {
          organizationName: LAYOUT_PREVIEW_FIXTURES.organizationName,
          postalAddress: LAYOUT_PREVIEW_FIXTURES.postalAddress,
          complianceContactEmail: LAYOUT_PREVIEW_FIXTURES.complianceContactEmail,
        },
      },
    );
  }, [htmlSource, layoutId, variablesSchema, plainTextTemplate]);

  return {
    plainTextTemplate,
    renderedPreview,
    previewRecipientEmail: LAYOUT_PREVIEW_FIXTURES.contactEmail,
    previewFromEmail: LAYOUT_PREVIEW_FIXTURES.fromEmail,
  };
}
