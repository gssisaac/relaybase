"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  applyTriggerPreviewMergeTags,
  composeMergeTagSectionsForTrigger,
  sampleTriggerPreviewValues,
} from "@/scale/lib/triggers/trigger-merge-tags";
import {
  applyTemplateVariablesToHtml,
  resolveTemplateVariableDefaults,
} from "@/scale/lib/layouts/layout-template-variables";
import { prepareLayoutTemplateHtml } from "@/scale/lib/layouts/layout-standard-footer";
import { isPlainTextTemplate } from "@/scale/lib/layouts/layout-catalog";
import {
  complianceFromIdentity,
  effectiveComplianceIdentityId,
  findComplianceIdentityById,
} from "@/scale/lib/compliance-identity";
import { scaleApi, type Trigger, type ScaleAccountCompliance, type ScaleLayout } from "@/lib/scale/api";

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
  templates: ScaleLayout[];
  subject: string;
  bodyMarkdown: string;
  previewHtml: string;
  templateId: string;
  templateVariables: Record<string, string>;
}) {
  const [compliance, setCompliance] = useState<ScaleAccountCompliance | null>(null);
  const [accountDefaultComplianceIdentityId, setAccountDefaultComplianceIdentityId] = useState<
    string | null
  >(null);

  const refreshComplianceContext = useCallback(async () => {
    try {
      const res = await scaleApi.listComplianceIdentities();
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
    () => (trigger ? composeMergeTagSectionsForTrigger(trigger.source) : []),
    [trigger?.source],
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

  const previewSubject = useMemo(
    () => applyTriggerPreviewMergeTags(subject, PREVIEW_RECIPIENT, previewMergeOptions),
    [subject, previewMergeOptions],
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

  const preparedTemplateHtml = useMemo(() => {
    const shell = prepareLayoutTemplateHtml(template?.htmlSource ?? "", templateId);
    return applyTemplateVariablesToHtml(
      shell,
      template?.variablesSchema ?? null,
      resolvedTemplateVariables,
    );
  }, [template?.htmlSource, template?.variablesSchema, templateId, resolvedTemplateVariables]);

  const renderedPreview = useMemo(() => {
    if (plainTextTemplate) {
      const body = bodyMarkdown.trim() || "Nothing to preview yet";
      const wrapped = preparedTemplateHtml.replaceAll("{{content}}", body);
      return applyTriggerPreviewMergeTags(wrapped, PREVIEW_RECIPIENT, previewMergeOptions);
    }
    const content = previewHtml || "<p style='color:#94a3b8'>Nothing to preview yet</p>";
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
