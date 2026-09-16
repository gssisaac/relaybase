"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { newsletterDetailHref } from "@/scale/lib/paths";

import {
  applyNewsletterMergeTags,
  previewPersonaOptions,
  resolvePreviewRecipient,
  type PreviewPersonaId,
} from "@/scale/lib/newsletters/newsletter-merge-tags";
import {
  applyTemplateVariablesToHtml,
  resolveTemplateVariableDefaults,
} from "@/scale/lib/layouts/layout-template-variables";
import { prepareLayoutTemplateHtml } from "@/scale/lib/layouts/layout-standard-footer";
import { isPlainTextTemplate } from "@/scale/lib/layouts/layout-catalog";
import { plainEmailBodyFromMarkdown } from "@/scale/lib/markdown/markdown-to-plain-email-text";
import { MessageTemplatePicker } from "@/scale/components/templates/MessageTemplatePicker";
import { NewsletterComposeForm } from "@/scale/pages/newsletters/NewsletterComposeForm";
import { messageTemplateDetailHref } from "@/scale/lib/template-paths";
import type { MessageTemplate } from "@/lib/scale/api";
import { useNewsletterDetail } from "@/scale/pages/newsletters/NewsletterDetailContext";
import {
  complianceFromIdentity,
  effectiveComplianceIdentityId,
  findComplianceIdentityById,
} from "@/scale/lib/compliance-identity";
import { buildPreviewUnsubscribeUrl } from "@/scale/lib/preview-unsubscribe-url";
import { scaleApi, type NewsletterStatus, type ScaleAccountCompliance } from "@/lib/scale/api";
import {
  useNewsletterEditorPersistence,
  type NewsletterPersistBridge,
} from "@/lib/markdown-editor";
import { SAVE_STATUS } from "@/lib/markdown-editor/persistence/constants";
import type { SaveStatus } from "@/lib/markdown-editor/persistence/types";

function mapSaveStatus(status: SaveStatus | null): "idle" | "saving" | "error" {
  if (status === SAVE_STATUS.SAVING) return "saving";
  if (status === SAVE_STATUS.ERROR) return "error";
  return "idle";
}

function lockedNewsletterMessage(
  status: NewsletterStatus,
  scheduledAt: string | null | undefined,
  sentAt: string | null | undefined,
): string {
  if (status === "scheduled" && scheduledAt) {
    return `This newsletter is scheduled for ${new Date(scheduledAt).toLocaleString()} and is locked.`;
  }
  if (status === "sending") {
    return "This newsletter is currently sending and is locked.";
  }
  if (status === "failed") {
    return "This newsletter failed to send and is locked.";
  }
  return `This newsletter was sent on ${sentAt ? new Date(sentAt).toLocaleDateString() : "an earlier date"} and is locked.`;
}

export function NewsletterContentView() {
  const router = useRouter();
  const {
    newsletterId,
    newsletter,
    templates,
    audienceMembers,
    syncDraft,
    persistDraft,
    getLastSavedDraft,
    refreshTemplates,
    setNewsletter,
  } = useNewsletterDetail();

  const [compliance, setCompliance] = useState<ScaleAccountCompliance | null>(null);
  const [accountDefaultComplianceIdentityId, setAccountDefaultComplianceIdentityId] = useState<
    string | null
  >(null);
  const [subject, setSubject] = useState(newsletter?.subject ?? "");
  const [bodyMarkdown, setBodyMarkdown] = useState(newsletter?.bodyMarkdown ?? "");
  const [previewHtml, setPreviewHtml] = useState("");
  const [templateId, setTemplateId] = useState(newsletter?.layoutId ?? templates[0]?.id ?? "");
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>(
    newsletter?.templateVariables ?? {},
  );
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [previewPersonaId, setPreviewPersonaId] = useState<PreviewPersonaId>("sample-named");
  const [duplicating, setDuplicating] = useState(false);

  const editable = newsletter?.status === "draft";

  const bridge = useMemo<NewsletterPersistBridge>(
    () => ({
      getDraft: () => ({ subject, bodyMarkdown, templateId, templateVariables }),
      setBodyMarkdown: (body) => setBodyMarkdown(body),
      getLastPersistedBody: () => getLastSavedDraft().bodyMarkdown,
      persist: async () => {
        const ok = await persistDraft();
        if (!ok) throw new Error("persist failed");
      },
    }),
    [subject, bodyMarkdown, templateId, templateVariables, getLastSavedDraft, persistDraft],
  );

  const { editorRef, ingestBody, checkpoint, saveStatus } = useNewsletterEditorPersistence({
    newsletterId: newsletterId,
    beaconPath: `newsletters/${newsletterId}`,
    editable: Boolean(editable),
    bridge,
  });

  const saveState = mapSaveStatus(saveStatus);

  useEffect(() => {
    setPreviewHtml("");
    setPreviewPersonaId("sample-named");
  }, [newsletterId]);

  useEffect(() => {
    if (!newsletter) return;
    setTemplateVariables(newsletter.templateVariables ?? {});
  }, [newsletter?.id, newsletter?.templateVariables]);

  const refreshComplianceContext = useCallback(async () => {
    try {
      const res = await scaleApi.listComplianceIdentities();
      setAccountDefaultComplianceIdentityId(res.defaultComplianceIdentityId);
      const effectiveId = effectiveComplianceIdentityId(
        newsletter?.complianceIdentityId,
        res.defaultComplianceIdentityId,
      );
      setCompliance(complianceFromIdentity(findComplianceIdentityById(res.identities, effectiveId)));
    } catch {
      setCompliance(null);
    }
  }, [newsletter?.complianceIdentityId]);

  useEffect(() => {
    void refreshComplianceContext();
  }, [refreshComplianceContext, newsletterId]);

  const personaOptions = useMemo(
    () => previewPersonaOptions(audienceMembers),
    [audienceMembers],
  );

  const previewRecipient = useMemo(
    () => resolvePreviewRecipient(previewPersonaId, audienceMembers),
    [previewPersonaId, audienceMembers],
  );

  const messageTemplateId = newsletter?.messageTemplateId ?? null;

  useEffect(() => {
    syncDraft({
      subject,
      bodyMarkdown,
      templateId,
      templateVariables,
      messageTemplateId,
    });
  }, [subject, bodyMarkdown, templateId, templateVariables, messageTemplateId, syncDraft]);

  async function applyMessageTemplate(template: MessageTemplate | null) {
    if (!editable || !newsletter) return;
    try {
      if (!template) {
        const updated = await scaleApi.updateNewsletter(newsletterId, { messageTemplateId: null });
        setNewsletter(updated);
        syncDraft({
          subject,
          bodyMarkdown,
          templateId,
          templateVariables,
          messageTemplateId: null,
        });
        return;
      }
      setSubject(template.subject);
      setBodyMarkdown(template.bodyMarkdown);
      if (template.layoutId) setTemplateId(template.layoutId);
      ingestBody(template.bodyMarkdown, newsletterId);
      const updated = await scaleApi.updateNewsletter(newsletterId, {
        messageTemplateId: template.id,
        subject: template.subject,
        bodyMarkdown: template.bodyMarkdown,
        layoutId: template.layoutId ?? undefined,
      });
      setNewsletter(updated);
      syncDraft({
        subject: template.subject,
        bodyMarkdown: template.bodyMarkdown,
        templateId: template.layoutId ?? templateId,
        templateVariables,
        messageTemplateId: template.id,
      });
      toast.success(`Linked “${template.name}”`);
    } catch {
      toast.error("Could not link template");
    }
  }

  useEffect(() => {
    if (!newsletter || !editable) return;
    const timer = setTimeout(() => {
      void persistDraft();
    }, 3000);
    return () => clearTimeout(timer);
  }, [subject, templateId, templateVariables, newsletter, editable, persistDraft]);

  const template = templates.find((t) => t.id === templateId);
  const plainTextTemplate = isPlainTextTemplate(templateId);
  const previewMergeOptions = useMemo(
    () => ({
      unsubscribeUrl: buildPreviewUnsubscribeUrl(newsletterId, previewPersonaId, audienceMembers),
      compliancePreviewPlaceholders: true,
      compliancePlaceholderFormat: (plainTextTemplate ? "plain" : "html") as "plain" | "html",
      compliance: {
        organizationName: compliance?.organizationName ?? null,
        postalAddress: compliance?.postalAddress ?? null,
        complianceContactEmail: compliance?.contactEmail ?? null,
      },
    }),
    [newsletterId, previewPersonaId, audienceMembers, compliance, plainTextTemplate],
  );

  const previewSubject = useMemo(
    () => applyNewsletterMergeTags(subject, previewRecipient, previewMergeOptions),
    [subject, previewRecipient, previewMergeOptions],
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
      return applyNewsletterMergeTags(wrapped, previewRecipient, previewMergeOptions);
    }
    const content = previewHtml || "<p style='color:#94a3b8'>Nothing to preview yet</p>";
    if (!template) {
      return applyNewsletterMergeTags(content, previewRecipient, previewMergeOptions);
    }
    const wrapped = preparedTemplateHtml.replaceAll("{{content}}", content);
    return applyNewsletterMergeTags(wrapped, previewRecipient, previewMergeOptions);
  }, [
    template,
    preparedTemplateHtml,
    plainTextTemplate,
    bodyMarkdown,
    previewHtml,
    previewRecipient,
    previewMergeOptions,
  ]);

  async function handleSave() {
    await checkpoint("manual-save");
    const saved = await persistDraft();
    if (saved) toast.success("Newsletter saved");
    else toast.error("Could not save newsletter");
  }

  async function handleDuplicate() {
    setDuplicating(true);
    try {
      const duplicate = await scaleApi.duplicateNewsletter(newsletterId);
      router.push(newsletterDetailHref(duplicate.id, "content"));
    } catch {
      toast.error("Could not duplicate newsletter");
      setDuplicating(false);
    }
  }

  if (!newsletter) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {!editable ? (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-2">
          <p className="text-xs text-muted-foreground">
            {lockedNewsletterMessage(newsletter.status, newsletter.scheduledAt, newsletter.sentAt)}
          </p>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={() => void handleDuplicate()}
            disabled={duplicating}
          >
            {duplicating ? "Duplicating…" : "Duplicate as New Draft"}
          </Button>
        </div>
      ) : null}
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
            <Button size="sm" variant="outline" nativeButton={false} render={<Link href={messageTemplateDetailHref(messageTemplateId)} />}>
              Edit template
            </Button>
          ) : null}
        </div>
      ) : null}
      <NewsletterComposeForm
        newsletterId={newsletterId}
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
            if (prev !== markdown) ingestBody(markdown, newsletterId);
            return markdown;
          });
        }}
        renderedPreview={renderedPreview}
        previewSubject={previewSubject}
        previewFromName={newsletter.fromName}
        previewFromEmail={newsletter.fromEmail ?? "you@example.com"}
        previewToEmail={previewRecipient.email}
        previewIsPlainText={plainTextTemplate}
        device={device}
        setDevice={setDevice}
        editable={Boolean(editable)}
        saveState={saveState}
        onSave={() => void handleSave()}
        previewPersonaId={previewPersonaId}
        setPreviewPersonaId={setPreviewPersonaId}
        previewRecipient={previewRecipient}
        personaOptions={personaOptions}
        compliance={compliance}
        complianceIdentityId={newsletter.complianceIdentityId ?? null}
        accountDefaultComplianceIdentityId={accountDefaultComplianceIdentityId}
        onComplianceIdentityChange={async (id) => {
          const updated = await scaleApi.updateNewsletter(newsletterId, {
            complianceIdentityId: id,
          });
          setNewsletter(updated);
          await refreshComplianceContext();
        }}
        onComplianceIdentitySaved={() => void refreshComplianceContext()}
        onTemplateImported={(id) => {
          void refreshTemplates();
          setTemplateId(id);
        }}
        onTemplateSourceSaved={({ templateId, forked }) => {
          void refreshTemplates();
          if (forked) setTemplateId(templateId);
        }}
      />
    </div>
  );
}
