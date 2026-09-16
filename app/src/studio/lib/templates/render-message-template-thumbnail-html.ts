import { applyGmailContentLinkStyles } from "@/lib/markdown-editor/utils/editor-markdown";
import { isPlainTextTemplate } from "@/studio/lib/layouts/layout-catalog";
import { wrapLayoutBodyHtml } from "@/studio/lib/layouts/layout-content-theme";
import { LAYOUT_PREVIEW_FIXTURES } from "@/studio/lib/layouts/layout-preview-sample-values";
import { prepareLayoutTemplateHtml } from "@/studio/lib/layouts/layout-standard-footer";
import {
  applyTemplateVariablesToComposeContent,
  applyTemplateVariablesToHtml,
  resolveTemplateVariableDefaults,
} from "@/studio/lib/layouts/layout-template-variables";
import { markdownToEmailHtml } from "@/studio/lib/markdown/markdown-to-email-html";
import { plainEmailBodyFromMarkdown } from "@/studio/lib/markdown/markdown-to-plain-email-text";
import { applyNewsletterMergeTags } from "@/studio/lib/newsletters/newsletter-merge-tags";
import type { StudioLayout, StudioTemplate } from "@/lib/studio/api";

const PREVIEW_RECIPIENT = {
  email: LAYOUT_PREVIEW_FIXTURES.contactEmail,
  name: LAYOUT_PREVIEW_FIXTURES.contactName,
};

export type TemplateThumbnailSource = {
  bodyMarkdown: string;
  layoutId: string | null;
  templateVariables: Record<string, string>;
  subject: string;
};

/** Full HTML document body for catalog template thumbnail capture (layout + markdown body). */
export function renderTemplateThumbnailHtml(input: {
  template: TemplateThumbnailSource;
  layout: StudioLayout | null;
  defaultBrandLogoUrl?: string;
}): string {
  const layoutId = input.template.layoutId ?? input.layout?.id ?? "";
  const plainText = isPlainTextTemplate(layoutId);

  const previewMergeOptions = {
    compliancePreviewPlaceholders: true as const,
    compliancePlaceholderFormat: (plainText ? "plain" : "html") as "plain" | "html",
    compliance: {
      organizationName: LAYOUT_PREVIEW_FIXTURES.organizationName,
      postalAddress: LAYOUT_PREVIEW_FIXTURES.postalAddress,
      complianceContactEmail: LAYOUT_PREVIEW_FIXTURES.complianceContactEmail,
    },
    unsubscribeUrl: LAYOUT_PREVIEW_FIXTURES.unsubscribeUrl,
  };

  const resolvedTemplateVariables = resolveTemplateVariableDefaults({
    schema: input.layout?.variablesSchema ?? null,
    values: input.template.templateVariables,
    complianceOrganizationName: LAYOUT_PREVIEW_FIXTURES.organizationName,
  });

  const preparedTemplateHtml = applyTemplateVariablesToHtml(
    prepareLayoutTemplateHtml(input.layout?.htmlSource ?? "", layoutId),
    input.layout?.variablesSchema ?? null,
    resolvedTemplateVariables,
    { defaultBrandLogoUrl: input.defaultBrandLogoUrl },
  );

  const schema = input.layout?.variablesSchema ?? null;
  const contentVarsInput = {
    plainText: plainText,
    schema,
    values: resolvedTemplateVariables,
    defaultBrandLogoUrl: input.defaultBrandLogoUrl,
  };

  let contentHtml: string;
  if (plainText) {
    contentHtml = applyTemplateVariablesToComposeContent(
      plainEmailBodyFromMarkdown(input.template.bodyMarkdown),
      contentVarsInput,
    );
  } else {
    const md = input.template.bodyMarkdown.trim();
    const rawContent = md
      ? wrapLayoutBodyHtml(
          applyGmailContentLinkStyles(markdownToEmailHtml(md)),
          layoutId,
        )
      : "<p style='color:#94a3b8'>Nothing to preview yet</p>";
    contentHtml = applyTemplateVariablesToComposeContent(rawContent, {
      ...contentVarsInput,
      plainText: false,
    });
  }

  if (!input.layout && !plainText) {
    return applyNewsletterMergeTags(contentHtml, PREVIEW_RECIPIENT, previewMergeOptions);
  }

  const wrapped = preparedTemplateHtml.replaceAll("{{content}}", contentHtml);
  return applyNewsletterMergeTags(wrapped, PREVIEW_RECIPIENT, previewMergeOptions);
}

export const renderMessageTemplateThumbnailHtml = renderTemplateThumbnailHtml;
