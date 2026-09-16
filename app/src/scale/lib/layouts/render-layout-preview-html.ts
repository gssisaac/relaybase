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

export function renderLayoutPreviewHtml({
  layoutId,
  htmlSource,
  variablesSchema,
  defaultBrandLogoUrl,
}: {
  layoutId: string;
  htmlSource: string;
  variablesSchema: TemplateVariablesSchema | null | undefined;
  /** Inline or same-origin URL — used by thumbnail generator (avoids broken remote logo). */
  defaultBrandLogoUrl?: string;
}): string {
  const plainTextTemplate = isPlainTextTemplate(layoutId);
  const shell = prepareLayoutTemplateHtml(htmlSource, layoutId);
  const templateVariables = hardcodedLayoutTemplateVariables(variablesSchema);
  const withVars = applyTemplateVariablesToHtml(shell, variablesSchema, templateVariables, {
    defaultBrandLogoUrl,
  });
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
}
