"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { applyNewsletterMergeTags } from "@/studio/lib/newsletters/newsletter-merge-tags";
import {
  applyTemplateVariablesToComposeContent,
  applyTemplateVariablesToHtml,
  applyTemplateVariablesToPlainText,
  resolveTemplateVariableDefaults,
} from "@/studio/lib/layouts/layout-template-variables";
import { prepareLayoutTemplateHtml } from "@/studio/lib/layouts/layout-standard-footer";
import { isPlainTextTemplate } from "@/studio/lib/layouts/layout-catalog";
import { plainEmailBodyFromMarkdown } from "@/studio/lib/markdown/markdown-to-plain-email-text";
import {
  complianceFromIdentity,
  effectiveComplianceIdentityId,
  findComplianceIdentityById,
} from "@/studio/lib/compliance/compliance-identity";
import { studioApi, type StudioAccountCompliance, type StudioLayout } from "@/studio/api";

const PREVIEW_RECIPIENT = {
  email: "alex@example.com",
  name: "Alex Kim",
  label: "Sample recipient",
};

export function useMessageRenderedPreview({
  messageId,
  layouts,
  subject,
  bodyMarkdown,
  previewHtml,
  templateId,
  templateVariables,
}: {
  messageId: string;
  layouts: StudioLayout[];
  subject: string;
  bodyMarkdown: string;
  previewHtml: string;
  templateId: string;
  templateVariables: Record<string, string>;
}) {
  const [compliance, setCompliance] = useState<StudioAccountCompliance | null>(null);
  const [accountDefaultComplianceIdentityId, setAccountDefaultComplianceIdentityId] = useState<
    string | null
  >(null);
  const [previewComplianceIdentityId, setPreviewComplianceIdentityId] = useState<string | null>(
    null,
  );

  const refreshComplianceContext = useCallback(async () => {
    try {
      const res = await studioApi.listComplianceIdentities();
      setAccountDefaultComplianceIdentityId(res.defaultComplianceIdentityId);
      const effectiveId = effectiveComplianceIdentityId(
        previewComplianceIdentityId,
        res.defaultComplianceIdentityId,
      );
      setCompliance(complianceFromIdentity(findComplianceIdentityById(res.identities, effectiveId)));
    } catch {
      setCompliance(null);
    }
  }, [previewComplianceIdentityId]);

  useEffect(() => {
    void refreshComplianceContext();
  }, [refreshComplianceContext, messageId]);

  const layout = layouts.find((t) => t.id === templateId);
  const plainTextTemplate = isPlainTextTemplate(templateId);

  const previewMergeOptions = useMemo(
    () => ({
      compliancePreviewPlaceholders: true,
      compliancePlaceholderFormat: (plainTextTemplate ? "plain" : "html") as "plain" | "html",
      compliance: {
        organizationName: compliance?.organizationName ?? null,
        postalAddress: compliance?.postalAddress ?? null,
        complianceContactEmail: compliance?.contactEmail ?? null,
      },
    }),
    [compliance, plainTextTemplate],
  );

  const resolvedTemplateVariables = useMemo(
    () =>
      resolveTemplateVariableDefaults({
        schema: layout?.variablesSchema ?? null,
        values: templateVariables,
        complianceOrganizationName: compliance?.organizationName,
      }),
    [layout?.variablesSchema, templateVariables, compliance?.organizationName],
  );

  const previewSubject = useMemo(() => {
    const withLayoutVars = applyTemplateVariablesToPlainText(
      subject,
      layout?.variablesSchema ?? null,
      resolvedTemplateVariables,
    );
    return applyNewsletterMergeTags(withLayoutVars, PREVIEW_RECIPIENT, previewMergeOptions);
  }, [subject, layout?.variablesSchema, resolvedTemplateVariables, previewMergeOptions]);

  const preparedTemplateHtml = useMemo(() => {
    const shell = prepareLayoutTemplateHtml(layout?.htmlSource ?? "", templateId);
    return applyTemplateVariablesToHtml(
      shell,
      layout?.variablesSchema ?? null,
      resolvedTemplateVariables,
    );
  }, [layout?.htmlSource, layout?.variablesSchema, templateId, resolvedTemplateVariables]);

  const renderedPreview = useMemo(() => {
    const schema = layout?.variablesSchema ?? null;
    const contentVarsInput = {
      plainText: plainTextTemplate,
      schema,
      values: resolvedTemplateVariables,
    };
    if (plainTextTemplate) {
      const body = applyTemplateVariablesToComposeContent(
        plainEmailBodyFromMarkdown(bodyMarkdown),
        contentVarsInput,
      );
      const wrapped = preparedTemplateHtml.replaceAll("{{content}}", body);
      return applyNewsletterMergeTags(wrapped, PREVIEW_RECIPIENT, previewMergeOptions);
    }
    const rawContent = previewHtml || "<p style='color:#94a3b8'>Nothing to preview yet</p>";
    const content = applyTemplateVariablesToComposeContent(rawContent, {
      ...contentVarsInput,
      plainText: false,
    });
    if (!layout) {
      return applyNewsletterMergeTags(content, PREVIEW_RECIPIENT, previewMergeOptions);
    }
    const wrapped = preparedTemplateHtml.replaceAll("{{content}}", content);
    return applyNewsletterMergeTags(wrapped, PREVIEW_RECIPIENT, previewMergeOptions);
  }, [
    layout,
    preparedTemplateHtml,
    plainTextTemplate,
    bodyMarkdown,
    previewHtml,
    previewMergeOptions,
    resolvedTemplateVariables,
  ]);

  return {
    PREVIEW_RECIPIENT,
    plainTextTemplate,
    previewSubject,
    renderedPreview,
    previewComplianceIdentityId,
    setPreviewComplianceIdentityId,
    accountDefaultComplianceIdentityId,
    refreshComplianceContext,
  };
}
