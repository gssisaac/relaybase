"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
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
import { NewsletterComposeForm } from "@/studio/pages/newsletters/NewsletterComposeForm";
import { useMessageDetail } from "@/studio/pages/messages/MessageDetailContext";
import { useTemplateEditChrome } from "@/studio/pages/messages/template-edit-chrome";
import {
  complianceFromIdentity,
  effectiveComplianceIdentityId,
  findComplianceIdentityById,
} from "@/studio/lib/compliance-identity";
import { studioApi, type StudioAccountCompliance } from "@/lib/studio/api";
import {
  useNewsletterEditorPersistence,
  type NewsletterPersistBridge,
} from "@/lib/markdown-editor";
import { SAVE_STATUS } from "@/lib/markdown-editor/persistence/constants";
import type { SaveStatus } from "@/lib/markdown-editor/persistence/types";

const PREVIEW_FROM = {
  name: "Your organization",
  email: "hello@yourdomain.com",
};

function mapSaveStatus(status: SaveStatus | null): "idle" | "saving" | "error" {
  if (status === SAVE_STATUS.SAVING) return "saving";
  if (status === SAVE_STATUS.ERROR) return "error";
  return "idle";
}

export function MessageContentView() {
  const {
    messageId,
    message,
    layouts,
    syncDraft,
    persistDraft,
    getLastSavedDraft,
    refreshLayouts,
  } = useMessageDetail();
  const { name, setName, setSubjectFallback, setSaveState, registerSave } =
    useTemplateEditChrome();

  const [compliance, setCompliance] = useState<StudioAccountCompliance | null>(null);
  const [accountDefaultComplianceIdentityId, setAccountDefaultComplianceIdentityId] = useState<
    string | null
  >(null);
  const [previewComplianceIdentityId, setPreviewComplianceIdentityId] = useState<string | null>(
    null,
  );
  const [subject, setSubject] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [bodyMarkdown, setBodyMarkdown] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [layoutId, setLayoutId] = useState("");
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [previewPersonaId, setPreviewPersonaId] = useState<PreviewPersonaId>("sample-named");

  const editable = Boolean(message);

  const bridge = useMemo<NewsletterPersistBridge>(
    () => ({
      getDraft: () => ({ subject, bodyMarkdown, templateId: layoutId, templateVariables }),
      setBodyMarkdown: (body) => setBodyMarkdown(body),
      getLastPersistedBody: () => getLastSavedDraft().bodyMarkdown,
      persist: async () => {
        const ok = await persistDraft();
        if (!ok) throw new Error("persist failed");
      },
    }),
    [subject, bodyMarkdown, layoutId, templateVariables, getLastSavedDraft, persistDraft],
  );

  const { editorRef, ingestBody, checkpoint, saveStatus } = useNewsletterEditorPersistence({
    newsletterId: messageId,
    beaconPath: `messages/${messageId}`,
    editable,
    bridge,
  });

  const saveState = mapSaveStatus(saveStatus);

  useEffect(() => {
    setSaveState(saveState);
  }, [saveState, setSaveState]);

  useEffect(() => {
    if (!message) return;
    setName(message.name);
    setSubject(message.subject);
    setSubjectFallback(message.subject);
    setPreviewText(message.previewText ?? "");
    setBodyMarkdown(message.bodyMarkdown);
    setLayoutId(message.layoutId ?? layouts[0]?.id ?? "");
    setTemplateVariables(message.templateVariables ?? {});
  }, [message?.id, message, layouts, setName, setSubjectFallback]);

  useEffect(() => {
    setSubjectFallback(subject);
  }, [subject, setSubjectFallback]);

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

  const personaOptions = useMemo(() => previewPersonaOptions([]), []);
  const previewRecipient = useMemo(
    () => resolvePreviewRecipient(previewPersonaId, []),
    [previewPersonaId],
  );

  useEffect(() => {
    syncDraft({
      name,
      subject,
      previewText,
      bodyMarkdown,
      templateId: layoutId,
      templateVariables,
    });
  }, [name, subject, previewText, bodyMarkdown, layoutId, templateVariables, syncDraft]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      void persistDraft();
    }, 3000);
    return () => clearTimeout(timer);
  }, [name, subject, previewText, layoutId, templateVariables, message, persistDraft]);

  const layout = layouts.find((t) => t.id === layoutId);
  const plainTextTemplate = isPlainTextTemplate(layoutId);
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
    return applyNewsletterMergeTags(withLayoutVars, previewRecipient, previewMergeOptions);
  }, [
    subject,
    layout?.variablesSchema,
    resolvedTemplateVariables,
    previewRecipient,
    previewMergeOptions,
  ]);

  const preparedTemplateHtml = useMemo(() => {
    const shell = prepareLayoutTemplateHtml(layout?.htmlSource ?? "", layoutId);
    return applyTemplateVariablesToHtml(
      shell,
      layout?.variablesSchema ?? null,
      resolvedTemplateVariables,
    );
  }, [layout?.htmlSource, layout?.variablesSchema, layoutId, resolvedTemplateVariables]);

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
      return applyNewsletterMergeTags(wrapped, previewRecipient, previewMergeOptions);
    }
    const rawContent = previewHtml || "<p style='color:#94a3b8'>Nothing to preview yet</p>";
    const content = applyTemplateVariablesToComposeContent(rawContent, {
      ...contentVarsInput,
      plainText: false,
    });
    if (!layout) {
      return applyNewsletterMergeTags(content, previewRecipient, previewMergeOptions);
    }
    const wrapped = preparedTemplateHtml.replaceAll("{{content}}", content);
    return applyNewsletterMergeTags(wrapped, previewRecipient, previewMergeOptions);
  }, [
    layout,
    preparedTemplateHtml,
    plainTextTemplate,
    bodyMarkdown,
    previewHtml,
    previewRecipient,
    previewMergeOptions,
    resolvedTemplateVariables,
  ]);

  const handleSave = useCallback(async () => {
    await checkpoint("manual-save");
    const saved = await persistDraft();
    if (saved) toast.success("Template saved");
    else toast.error("Could not save template");
  }, [checkpoint, persistDraft]);

  useEffect(() => {
    registerSave(handleSave);
  }, [registerSave, handleSave]);

  if (!message) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <NewsletterComposeForm
        newsletterId={messageId}
        assetOwner="message"
        editorRef={editorRef}
        templates={layouts}
        templateId={layoutId}
        setTemplateId={setLayoutId}
        templateVariables={templateVariables}
        setTemplateVariables={setTemplateVariables}
        subject={subject}
        setSubject={setSubject}
        bodyMarkdown={bodyMarkdown}
        onBodyChange={({ markdown, html }) => {
          setPreviewHtml(html);
          setBodyMarkdown((prev) => {
            if (prev !== markdown) ingestBody(markdown, messageId);
            return markdown;
          });
        }}
        renderedPreview={renderedPreview}
        previewSubject={previewSubject}
        previewFromName={PREVIEW_FROM.name}
        previewFromEmail={PREVIEW_FROM.email}
        previewToEmail={previewRecipient.email}
        previewIsPlainText={plainTextTemplate}
        device={device}
        setDevice={setDevice}
        editable={editable}
        saveState={saveState}
        onSave={() => void handleSave()}
        hideSaveButton
        previewPersonaId={previewPersonaId}
        setPreviewPersonaId={setPreviewPersonaId}
        previewRecipient={previewRecipient}
        personaOptions={personaOptions}
        compliance={compliance}
        complianceIdentityId={previewComplianceIdentityId}
        accountDefaultComplianceIdentityId={accountDefaultComplianceIdentityId}
        onComplianceIdentityChange={async (id) => {
          setPreviewComplianceIdentityId(id);
          await refreshComplianceContext();
        }}
        onComplianceIdentitySaved={() => void refreshComplianceContext()}
        onTemplateImported={(id) => {
          void refreshLayouts();
          setLayoutId(id);
        }}
        onTemplateSourceSaved={({ templateId: nextId, forked }) => {
          void refreshLayouts();
          if (forked) setLayoutId(nextId);
        }}
        layoutVariablesSchema={layout?.variablesSchema ?? null}
      />
    </div>
  );
}
