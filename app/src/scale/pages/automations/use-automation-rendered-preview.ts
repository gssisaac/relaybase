"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  applyAutomationPreviewMergeTags,
  composeMergeTagSectionsForAutomation,
  sampleTriggerPreviewValues,
} from "@/scale/lib/automation-merge-tags";
import {
  applyTemplateVariablesToHtml,
  resolveTemplateVariableDefaults,
} from "@/scale/lib/broadcast-template-variables";
import { prepareBroadcastTemplateHtml } from "@/scale/lib/broadcast-standard-footer";
import { isPlainTextTemplate } from "@/scale/lib/broadcast-templates";
import {
  complianceFromIdentity,
  effectiveComplianceIdentityId,
  findComplianceIdentityById,
} from "@/scale/lib/compliance-identity";
import { scaleApi, type Automation, type ScaleAccountCompliance, type ScaleTemplate } from "@/lib/scale/api";

const PREVIEW_RECIPIENT = {
  email: "alex@example.com",
  name: "Alex Kim",
  label: "Sample recipient",
};

export function useAutomationRenderedPreview({
  automationId,
  automation,
  templates,
  subject,
  bodyMarkdown,
  previewHtml,
  templateId,
  templateVariables,
}: {
  automationId: string;
  automation: Automation | null;
  templates: ScaleTemplate[];
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
        automation?.complianceIdentityId,
        res.defaultComplianceIdentityId,
      );
      setCompliance(complianceFromIdentity(findComplianceIdentityById(res.identities, effectiveId)));
    } catch {
      setCompliance(null);
    }
  }, [automation?.complianceIdentityId]);

  useEffect(() => {
    void refreshComplianceContext();
  }, [refreshComplianceContext, automationId]);

  const template = templates.find((t) => t.id === templateId);
  const plainTextTemplate = isPlainTextTemplate(templateId);

  const mergeTagSections = useMemo(
    () => (automation ? composeMergeTagSectionsForAutomation(automation.trigger) : []),
    [automation?.trigger],
  );

  const triggerPreviewValues = useMemo(
    () => (automation ? sampleTriggerPreviewValues(automation.trigger) : undefined),
    [automation?.trigger],
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
      trigger: automation?.trigger,
      triggerPayload: triggerPreviewValues,
    }),
    [compliance, plainTextTemplate, automation?.trigger, triggerPreviewValues],
  );

  const previewSubject = useMemo(
    () => applyAutomationPreviewMergeTags(subject, PREVIEW_RECIPIENT, previewMergeOptions),
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
    const shell = prepareBroadcastTemplateHtml(template?.htmlSource ?? "", templateId);
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
      return applyAutomationPreviewMergeTags(wrapped, PREVIEW_RECIPIENT, previewMergeOptions);
    }
    const content = previewHtml || "<p style='color:#94a3b8'>Nothing to preview yet</p>";
    if (!template) {
      return applyAutomationPreviewMergeTags(content, PREVIEW_RECIPIENT, previewMergeOptions);
    }
    const wrapped = preparedTemplateHtml.replaceAll("{{content}}", content);
    return applyAutomationPreviewMergeTags(wrapped, PREVIEW_RECIPIENT, previewMergeOptions);
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
