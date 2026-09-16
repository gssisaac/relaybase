"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { MessageTemplatePicker } from "@/scale/components/templates/MessageTemplatePicker";
import { messageTemplateDetailHref } from "@/scale/lib/template-paths";
import type { MessageTemplate } from "@/lib/scale/api";

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
import { plainEmailBodyFromMarkdown } from "@/scale/lib/markdown/markdown-to-plain-email-text";
import {
  complianceFromIdentity,
  effectiveComplianceIdentityId,
  findComplianceIdentityById,
} from "@/scale/lib/compliance-identity";
import { NewsletterComposeForm } from "@/scale/pages/newsletters/NewsletterComposeForm";
import { useTriggerDetail } from "@/scale/pages/triggers/TriggerDetailContext";
import { scaleApi, type ScaleAccountCompliance } from "@/lib/scale/api";
import {
  useNewsletterEditorPersistence,
  type NewsletterPersistBridge,
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

export function TriggerContentView() {
  const {
    triggerId,
    trigger,
    templates,
    syncDraft,
    persistDraft,
    getLastSavedDraft,
    refreshTemplates,
    setTrigger,
  } = useTriggerDetail();

  const [compliance, setCompliance] = useState<ScaleAccountCompliance | null>(null);
  const [accountDefaultComplianceIdentityId, setAccountDefaultComplianceIdentityId] = useState<
    string | null
  >(null);
  const [subject, setSubject] = useState(trigger?.subject ?? "");
  const [, setPreviewText] = useState(trigger?.previewText ?? "");
  const [bodyMarkdown, setBodyMarkdown] = useState(trigger?.bodyMarkdown ?? "");
  const [previewHtml, setPreviewHtml] = useState("");
  const [templateId, setTemplateId] = useState(trigger?.layoutId ?? templates[0]?.id ?? "");
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>(
    trigger?.templateVariables ?? {},
  );
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  const editable = trigger?.listStatus !== "archived";

  const bridge = useMemo<NewsletterPersistBridge>(
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

  const { editorRef, ingestBody, checkpoint, saveStatus } = useNewsletterEditorPersistence({
    newsletterId: triggerId,
    beaconPath: `triggers/${triggerId}`,
    editable: Boolean(editable),
    bridge,
  });

  const saveState = mapSaveStatus(saveStatus);

  useEffect(() => {
    if (!trigger) return;
    setSubject(trigger.subject);
    setPreviewText(trigger.previewText ?? "");
    setBodyMarkdown(trigger.bodyMarkdown);
    setTemplateId(trigger.layoutId ?? templates[0]?.id ?? "");
    setTemplateVariables(trigger.templateVariables ?? {});
  }, [trigger?.id, trigger, templates]);

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

  const messageTemplateId = trigger?.messageTemplateId ?? null;

  useEffect(() => {
    syncDraft({
      subject,
      bodyMarkdown,
      templateId,
      templateVariables,
      previewText: trigger?.previewText ?? "",
      messageTemplateId,
    });
  }, [
    subject,
    bodyMarkdown,
    templateId,
    templateVariables,
    trigger?.previewText,
    messageTemplateId,
    syncDraft,
  ]);

  async function applyMessageTemplate(template: MessageTemplate | null) {
    if (!editable || !trigger) return;
    try {
      if (!template) {
        const updated = await scaleApi.updateTrigger(triggerId, { messageTemplateId: null });
        setTrigger(updated);
        return;
      }
      setSubject(template.subject);
      setBodyMarkdown(template.bodyMarkdown);
      if (template.layoutId) setTemplateId(template.layoutId);
      ingestBody(template.bodyMarkdown, triggerId);
      const updated = await scaleApi.updateTrigger(triggerId, {
        messageTemplateId: template.id,
        subject: template.subject,
        bodyMarkdown: template.bodyMarkdown,
        layoutId: template.layoutId ?? undefined,
      });
      setTrigger(updated);
      toast.success(`Linked “${template.name}”`);
    } catch {
      toast.error("Could not link template");
    }
  }

  useEffect(() => {
    if (!trigger || !editable) return;
    const timer = setTimeout(() => {
      void persistDraft();
    }, 3000);
    return () => clearTimeout(timer);
  }, [subject, templateId, templateVariables, trigger, editable, persistDraft]);

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
      const body = plainEmailBodyFromMarkdown(bodyMarkdown);
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

  async function handleSave() {
    await checkpoint("manual-save");
    const saved = await persistDraft();
    if (saved) toast.success("Trigger saved");
    else toast.error("Could not save trigger");
  }

  if (!trigger) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {editable ? (
        <div className="flex shrink-0 flex-wrap items-end gap-3 border-b border-border px-4 py-3">
          <div className="min-w-[220px] flex-1 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Message template</p>
            <MessageTemplatePicker
              value={messageTemplateId}
              onApplied={(t) => void applyMessageTemplate(t)}
            />
          </div>
          {messageTemplateId ? (
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link href={messageTemplateDetailHref(messageTemplateId)} />}
            >
              Edit template
            </Button>
          ) : null}
        </div>
      ) : null}
      <NewsletterComposeForm
        newsletterId={triggerId}
        assetOwner="trigger"
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
            if (prev !== markdown) ingestBody(markdown, triggerId);
            return markdown;
          });
        }}
        renderedPreview={renderedPreview}
        previewSubject={previewSubject}
        previewFromName={trigger.fromName}
        previewFromEmail={trigger.fromEmail ?? "you@example.com"}
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
        complianceIdentityId={trigger.complianceIdentityId ?? null}
        accountDefaultComplianceIdentityId={accountDefaultComplianceIdentityId}
        onComplianceIdentityChange={async (id) => {
          const updated = await scaleApi.updateTrigger(triggerId, {
            complianceIdentityId: id,
          });
          setTrigger(updated);
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
        mergeTagSections={mergeTagSections}
        triggerPreviewValues={triggerPreviewValues}
      />
    </div>
  );
}
