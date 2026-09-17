"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { newsletterDetailHref } from "@/studio/lib/paths";

import {
  applyNewsletterMergeTags,
  previewPersonaOptions,
  resolvePreviewRecipient,
  type PreviewPersonaId,
} from "@/studio/lib/newsletters/newsletter-merge-tags";
import {
  applyTemplateVariablesToComposeContent,
  applyTemplateVariablesToHtml,
  applyTemplateVariablesToPlainText,
  resolveTemplateVariableDefaults,
} from "@/studio/lib/layouts/layout-template-variables";
import { prepareLayoutTemplateHtml } from "@/studio/lib/layouts/layout-standard-footer";
import { isPlainTextTemplate } from "@/studio/lib/layouts/layout-catalog";
import { plainEmailBodyFromMarkdown } from "@/studio/lib/markdown/markdown-to-plain-email-text";
import { MessagePicker } from "@/studio/components/messages/MessagePicker";
import { NewsletterComposeForm } from "@/studio/pages/newsletters/NewsletterComposeForm";
import { messageDetailHref } from "@/studio/lib/messages/message-paths";
import type { StudioMessage } from "@/studio/api";
import { useNewsletterDetail } from "@/studio/stores/newsletter-detail";
import {
  complianceFromIdentity,
  effectiveComplianceIdentityId,
  findComplianceIdentityById,
} from "@/studio/lib/compliance/compliance-identity";
import { buildPreviewUnsubscribeUrl } from "@/studio/lib/newsletters/preview-unsubscribe-url";
import { studioApi, type NewsletterStatus, type StudioAccountCompliance } from "@/studio/api";
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

  const [compliance, setCompliance] = useState<StudioAccountCompliance | null>(null);
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
      const res = await studioApi.listComplianceIdentities();
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

  const messageId = newsletter?.messageId ?? null;

  useEffect(() => {
    syncDraft({
      subject,
      bodyMarkdown,
      templateId,
      templateVariables,
      messageId,
    });
  }, [subject, bodyMarkdown, templateId, templateVariables, messageId, syncDraft]);

  async function applySavedMessage(source: StudioMessage | null) {
    if (!editable || !newsletter) return;
    try {
      if (!source) return;
      setSubject(source.subject);
      setBodyMarkdown(source.bodyMarkdown);
      if (source.layoutId) setTemplateId(source.layoutId);
      ingestBody(source.bodyMarkdown, newsletterId);
      const updated = await studioApi.updateNewsletter(newsletterId, {
        subject: source.subject,
        bodyMarkdown: source.bodyMarkdown,
        layoutId: source.layoutId ?? undefined,
        templateVariables: source.templateVariables,
      });
      setNewsletter(updated);
      syncDraft({
        subject: source.subject,
        bodyMarkdown: source.bodyMarkdown,
        templateId: source.layoutId ?? templateId,
        templateVariables: source.templateVariables,
        messageId: newsletter.messageId,
      });
      toast.success(`Inserted “${source.name}”`);
    } catch {
      toast.error("Could not insert message");
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
    return applyNewsletterMergeTags(withLayoutVars, previewRecipient, previewMergeOptions);
  }, [
    subject,
    template?.variablesSchema,
    resolvedTemplateVariables,
    previewRecipient,
    previewMergeOptions,
  ]);

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
      return applyNewsletterMergeTags(wrapped, previewRecipient, previewMergeOptions);
    }
    const rawContent = previewHtml || "<p style='color:#94a3b8'>Nothing to preview yet</p>";
    const content = applyTemplateVariablesToComposeContent(rawContent, {
      ...contentVarsInput,
      plainText: false,
    });
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
    resolvedTemplateVariables,
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
      const duplicate = await studioApi.duplicateNewsletter(newsletterId);
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
            <p className="text-xs font-medium text-muted-foreground">Saved message</p>
            <MessagePicker value={messageId} onApplied={(m) => void applySavedMessage(m)} />
          </div>
          {messageId ? (
            <Button size="sm" variant="outline" nativeButton={false} render={<Link href={messageDetailHref(messageId)} />}>
              Edit message
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
          const updated = await studioApi.updateNewsletter(newsletterId, {
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
        layoutVariablesSchema={template?.variablesSchema ?? null}
      />
    </div>
  );
}
