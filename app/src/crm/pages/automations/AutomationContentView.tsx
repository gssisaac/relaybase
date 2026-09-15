"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { applyAutomationPreviewMergeTags } from "@/crm/lib/automation-merge-tags";
import {
  applyTemplateVariablesToHtml,
  resolveTemplateVariableDefaults,
} from "@/crm/lib/broadcast-template-variables";
import { prepareBroadcastTemplateHtml } from "@/crm/lib/broadcast-standard-footer";
import { isPlainTextTemplate } from "@/crm/lib/broadcast-templates";
import {
  complianceFromIdentity,
  effectiveComplianceIdentityId,
  findComplianceIdentityById,
} from "@/crm/lib/compliance-identity";
import { BroadcastComposeForm } from "@/crm/pages/campaigns/BroadcastComposeForm";
import { useAutomationDetail } from "@/crm/pages/automations/AutomationDetailContext";
import { crmApi, type CrmAccountCompliance } from "@/lib/crm/api";
import {
  useCampaignEditorPersistence,
  type CampaignPersistBridge,
} from "@/lib/markdown-editor";
import { SAVE_STATUS } from "@/lib/markdown-editor/persistence/constants";
import type { SaveStatus } from "@/lib/markdown-editor/persistence/types";

const PREVIEW_RECIPIENT = {
  email: "alex@example.com",
  name: "Alex Kim",
  label: "Sample recipient",
};

function mapSaveStatus(status: SaveStatus | null): "idle" | "saving" | "error" {
  if (status === SAVE_STATUS.SAVING) return "saving";
  if (status === SAVE_STATUS.ERROR) return "error";
  return "idle";
}

export function AutomationContentView() {
  const {
    automationId,
    automation,
    templates,
    syncDraft,
    persistDraft,
    getLastSavedDraft,
    refreshTemplates,
    setAutomation,
  } = useAutomationDetail();

  const [compliance, setCompliance] = useState<CrmAccountCompliance | null>(null);
  const [accountDefaultComplianceIdentityId, setAccountDefaultComplianceIdentityId] = useState<
    string | null
  >(null);
  const [subject, setSubject] = useState(automation?.subject ?? "");
  const [, setPreviewText] = useState(automation?.previewText ?? "");
  const [bodyMarkdown, setBodyMarkdown] = useState(automation?.bodyMarkdown ?? "");
  const [previewHtml, setPreviewHtml] = useState("");
  const [templateId, setTemplateId] = useState(automation?.templateId ?? templates[0]?.id ?? "");
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>(
    automation?.templateVariables ?? {},
  );
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  const editable = automation?.listStatus !== "archived";

  const bridge = useMemo<CampaignPersistBridge>(
    () => ({
      getDraft: () => ({ subject, bodyMarkdown, templateId }),
      setBodyMarkdown: (body) => setBodyMarkdown(body),
      getLastPersistedBody: () => getLastSavedDraft().bodyMarkdown,
      persist: async () => {
        const ok = await persistDraft();
        if (!ok) throw new Error("persist failed");
      },
    }),
    [
      subject,
      bodyMarkdown,
      templateId,
      templateVariables,
      getLastSavedDraft,
      persistDraft,
    ],
  );

  const { editorRef, ingestBody, checkpoint, saveStatus } = useCampaignEditorPersistence({
    campaignId: automationId,
    beaconPath: `automations/${automationId}`,
    editable: Boolean(editable),
    bridge,
  });

  const saveState = mapSaveStatus(saveStatus);

  useEffect(() => {
    if (!automation) return;
    setSubject(automation.subject);
    setPreviewText(automation.previewText ?? "");
    setBodyMarkdown(automation.bodyMarkdown);
    setTemplateId(automation.templateId ?? templates[0]?.id ?? "");
    setTemplateVariables(automation.templateVariables ?? {});
  }, [automation?.id, automation, templates]);

  const refreshComplianceContext = useCallback(async () => {
    try {
      const res = await crmApi.listComplianceIdentities();
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

  useEffect(() => {
    syncDraft({ subject, bodyMarkdown, templateId, templateVariables, previewText: "" });
  }, [subject, bodyMarkdown, templateId, templateVariables, syncDraft]);

  useEffect(() => {
    if (!automation || !editable) return;
    const timer = setTimeout(() => {
      void persistDraft();
    }, 3000);
    return () => clearTimeout(timer);
  }, [subject, templateId, templateVariables, automation, editable, persistDraft]);

  const template = templates.find((t) => t.id === templateId);
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

  async function handleSave() {
    await checkpoint("manual-save");
    const saved = await persistDraft();
    if (saved) toast.success("Automation saved");
    else toast.error("Could not save automation");
  }

  if (!automation) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {automation.status === "active" ? (
        <div className="shrink-0 border-b border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
          Active automations apply content changes on the next send.
        </div>
      ) : null}
      <BroadcastComposeForm
        broadcastId={automationId}
        assetOwner="automation"
        editorRef={editorRef}
        templates={templates}
        templateId={templateId}
        setTemplateId={setTemplateId}
        templateVariables={templateVariables}
        setTemplateVariables={setTemplateVariables}
        subject={subject}
        setSubject={setSubject}
        bodyMarkdown={bodyMarkdown}
        onBodyChange={({ markdown, html }) => {
          setPreviewHtml(html);
          setBodyMarkdown((prev) => {
            if (prev !== markdown) ingestBody(markdown, automationId);
            return markdown;
          });
        }}
        renderedPreview={renderedPreview}
        previewSubject={previewSubject}
        previewFromName={automation.fromName}
        previewFromEmail={automation.fromEmail ?? "you@example.com"}
        previewToEmail={PREVIEW_RECIPIENT.email}
        previewIsPlainText={plainTextTemplate}
        device={device}
        setDevice={setDevice}
        editable={Boolean(editable)}
        saveState={saveState}
        onSave={() => void handleSave()}
        previewPersonaId="sample-named"
        setPreviewPersonaId={() => {}}
        previewRecipient={PREVIEW_RECIPIENT}
        personaOptions={[{ value: "sample-named" as const, label: PREVIEW_RECIPIENT.label }]}
        compliance={compliance}
        complianceIdentityId={automation.complianceIdentityId ?? null}
        accountDefaultComplianceIdentityId={accountDefaultComplianceIdentityId}
        onComplianceIdentityChange={async (id) => {
          const updated = await crmApi.updateAutomation(automationId, {
            complianceIdentityId: id,
          });
          setAutomation(updated);
          await refreshComplianceContext();
        }}
        onComplianceIdentitySaved={() => void refreshComplianceContext()}
        onTemplateImported={(id) => {
          void refreshTemplates();
          setTemplateId(id);
        }}
        onTemplateSourceSaved={({ templateId: nextId, forked }) => {
          void refreshTemplates();
          if (forked) setTemplateId(nextId);
        }}
      />
    </div>
  );
}
