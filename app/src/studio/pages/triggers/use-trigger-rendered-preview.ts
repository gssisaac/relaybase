"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  applyTriggerPreviewMergeTags,
  composeMergeTagSectionsForTrigger,
  sampleTriggerPreviewValues,
} from "@/studio/lib/triggers/trigger-merge-tags";
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
import { studioApi, type Trigger, type StudioAccountCompliance, type StudioLayout } from "@/studio/api";

const PREVIEW_RECIPIENT = {
  email: "alex@example.com",
  name: "Alex Kim",
  label: "Sample recipient",
};

export function useTriggerRenderedPreview({
  triggerId,
  trigger,
  templates,
  subject,
  bodyMarkdown,
  previewHtml,
  templateId,
  templateVariables,
}: {
  triggerId: string;
  trigger: Trigger | null;
  templates: StudioLayout[];
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

  const refreshComplianceContext = useCallback(async () => {
    try {
      const res = await studioApi.listComplianceIdentities();
      setAccountDefaultComplianceIdentityId(res.defaultComplianceIdentityId);
      const effectiveId = effectiveComplianceIdentityId(
        trigger?.complianceIdentityId,
        res.defaultComplianceIdentityId,
      );
      setCompliance(complianceFromIdentity(findComplianceIdentityById(res.identities, effectiveId)));
    } catch {
      setCompliance(null);
    }
  }, [trigger?.complianceIdentityId]);

  useEffect(() => {
    void refreshComplianceContext();
  }, [refreshComplianceContext, triggerId]);

  const template = templates.find((t) => t.id === templateId);
  const plainTextTemplate = isPlainTextTemplate(templateId);

  const mergeTagSections = useMemo(
    () =>
      trigger
        ? composeMergeTagSectionsForTrigger(trigger.source, template?.variablesSchema ?? null)
        : [],
    [trigger?.source, template?.variablesSchema],
  );

  const triggerPreviewValues = useMemo(
    () => (trigger ? sampleTriggerPreviewValues(trigger.source) : undefined),
    [trigger?.source],
  );

  const previewMergeOptions = useMemo(
    () => ({
      compliancePreviewPlaceholders: true,
      compliancePlaceholderFormat: (plainTextTemplate ? "plain" : "html") as "plain" | "html",
      compliance: {
        organizationName: compliance?.organizationName ?? null,
        postalAddress: compliance?.postalAddress ?? null,
        complianceContactEmail: compliance?.contactEmail ?? null,
      },
      source: trigger?.source,
      triggerPayload: triggerPreviewValues,
    }),
    [compliance, plainTextTemplate, trigger?.source, triggerPreviewValues],
  );

  const resolvedTemplateVariables = useMemo(
    () =>
      resolveTemplateVariableDefaults({
        schema: template?.variablesSchema ?? null,
        values: templateVariables,
        complianceOrganizationName: compliance?.organizationName,
      }),
    [template?.variablesSchema, templateVariables, compliance?.organizationName],
  );

  const previewSubject = useMemo(() => {
    const withLayoutVars = applyTemplateVariablesToPlainText(
      subject,
      template?.variablesSchema ?? null,
      resolvedTemplateVariables,
    );
    return applyTriggerPreviewMergeTags(withLayoutVars, PREVIEW_RECIPIENT, previewMergeOptions);
  }, [subject, template?.variablesSchema, resolvedTemplateVariables, previewMergeOptions]);

  const preparedTemplateHtml = useMemo(() => {
    const shell = prepareLayoutTemplateHtml(template?.htmlSource ?? "", templateId);
    return applyTemplateVariablesToHtml(
      shell,
      template?.variablesSchema ?? null,
      resolvedTemplateVariables,
    );
  }, [template?.htmlSource, template?.variablesSchema, templateId, resolvedTemplateVariables]);

  const renderedPreview = useMemo(() => {
    const schema = template?.variablesSchema ?? null;
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
      return applyTriggerPreviewMergeTags(wrapped, PREVIEW_RECIPIENT, previewMergeOptions);
    }
    const rawContent = previewHtml || "<p style='color:#94a3b8'>Nothing to preview yet</p>";
    const content = applyTemplateVariablesToComposeContent(rawContent, {
      ...contentVarsInput,
      plainText: false,
    });
    if (!template) {
      return applyTriggerPreviewMergeTags(content, PREVIEW_RECIPIENT, previewMergeOptions);
    }
    const wrapped = preparedTemplateHtml.replaceAll("{{content}}", content);
    return applyTriggerPreviewMergeTags(wrapped, PREVIEW_RECIPIENT, previewMergeOptions);
  }, [
    template,
    preparedTemplateHtml,
    plainTextTemplate,
    bodyMarkdown,
    previewHtml,
    previewMergeOptions,
    resolvedTemplateVariables,
  ]);

  return {
    PREVIEW_RECIPIENT,
    compliance,
    accountDefaultComplianceIdentityId,
    refreshComplianceContext,
    plainTextTemplate,
    mergeTagSections,
    triggerPreviewValues,
    previewSubject,
    renderedPreview,
  };
}
