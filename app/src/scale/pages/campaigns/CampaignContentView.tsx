"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { campaignDetailHref } from "@/scale/lib/paths";

import {
  applyCampaignMergeTags,
  previewPersonaOptions,
  resolvePreviewRecipient,
  type PreviewPersonaId,
} from "@/scale/lib/campaigns/campaign-merge-tags";
import {
  applyTemplateVariablesToHtml,
  resolveTemplateVariableDefaults,
} from "@/scale/lib/layouts/layout-template-variables";
import { prepareLayoutTemplateHtml } from "@/scale/lib/layouts/layout-standard-footer";
import { isPlainTextTemplate } from "@/scale/lib/layouts/layout-catalog";
import { MessageTemplatePicker } from "@/scale/components/templates/MessageTemplatePicker";
import { CampaignComposeForm } from "@/scale/pages/campaigns/CampaignComposeForm";
import { messageTemplateDetailHref } from "@/scale/lib/template-paths";
import type { MessageTemplate } from "@/lib/scale/api";
import { useCampaignDetail } from "@/scale/pages/campaigns/CampaignDetailContext";
import {
  complianceFromIdentity,
  effectiveComplianceIdentityId,
  findComplianceIdentityById,
} from "@/scale/lib/compliance-identity";
import { buildPreviewUnsubscribeUrl } from "@/scale/lib/preview-unsubscribe-url";
import { scaleApi, type CampaignStatus, type ScaleAccountCompliance } from "@/lib/scale/api";
import {
  useCampaignEditorPersistence,
  type CampaignPersistBridge,
} from "@/lib/markdown-editor";
import { SAVE_STATUS } from "@/lib/markdown-editor/persistence/constants";
import type { SaveStatus } from "@/lib/markdown-editor/persistence/types";

function mapSaveStatus(status: SaveStatus | null): "idle" | "saving" | "error" {
  if (status === SAVE_STATUS.SAVING) return "saving";
  if (status === SAVE_STATUS.ERROR) return "error";
  return "idle";
}

function lockedCampaignMessage(
  status: CampaignStatus,
  scheduledAt: string | null | undefined,
  sentAt: string | null | undefined,
): string {
  if (status === "scheduled" && scheduledAt) {
    return `This campaign is scheduled for ${new Date(scheduledAt).toLocaleString()} and is locked.`;
  }
  if (status === "sending") {
    return "This campaign is currently sending and is locked.";
  }
  if (status === "failed") {
    return "This campaign failed to send and is locked.";
  }
  return `This campaign was sent on ${sentAt ? new Date(sentAt).toLocaleDateString() : "an earlier date"} and is locked.`;
}

export function CampaignContentView() {
  const router = useRouter();
  const {
    campaignId,
    campaign,
    templates,
    audienceMembers,
    syncDraft,
    persistDraft,
    getLastSavedDraft,
    refreshTemplates,
    setCampaign,
  } = useCampaignDetail();

  const [compliance, setCompliance] = useState<ScaleAccountCompliance | null>(null);
  const [accountDefaultComplianceIdentityId, setAccountDefaultComplianceIdentityId] = useState<
    string | null
  >(null);
  const [subject, setSubject] = useState(campaign?.subject ?? "");
  const [bodyMarkdown, setBodyMarkdown] = useState(campaign?.bodyMarkdown ?? "");
  const [previewHtml, setPreviewHtml] = useState("");
  const [templateId, setTemplateId] = useState(campaign?.layoutId ?? templates[0]?.id ?? "");
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>(
    campaign?.templateVariables ?? {},
  );
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [previewPersonaId, setPreviewPersonaId] = useState<PreviewPersonaId>("sample-named");
  const [duplicating, setDuplicating] = useState(false);

  const editable = campaign?.status === "draft";

  const bridge = useMemo<CampaignPersistBridge>(
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

  const { editorRef, ingestBody, checkpoint, saveStatus } = useCampaignEditorPersistence({
    campaignId: campaignId,
    beaconPath: `campaigns/${campaignId}`,
    editable: Boolean(editable),
    bridge,
  });

  const saveState = mapSaveStatus(saveStatus);

  useEffect(() => {
    setPreviewHtml("");
    setPreviewPersonaId("sample-named");
  }, [campaignId]);

  useEffect(() => {
    if (!campaign) return;
    setTemplateVariables(campaign.templateVariables ?? {});
  }, [campaign?.id, campaign?.templateVariables]);

  const refreshComplianceContext = useCallback(async () => {
    try {
      const res = await scaleApi.listComplianceIdentities();
      setAccountDefaultComplianceIdentityId(res.defaultComplianceIdentityId);
      const effectiveId = effectiveComplianceIdentityId(
        campaign?.complianceIdentityId,
        res.defaultComplianceIdentityId,
      );
      setCompliance(complianceFromIdentity(findComplianceIdentityById(res.identities, effectiveId)));
    } catch {
      setCompliance(null);
    }
  }, [campaign?.complianceIdentityId]);

  useEffect(() => {
    void refreshComplianceContext();
  }, [refreshComplianceContext, campaignId]);

  const personaOptions = useMemo(
    () => previewPersonaOptions(audienceMembers),
    [audienceMembers],
  );

  const previewRecipient = useMemo(
    () => resolvePreviewRecipient(previewPersonaId, audienceMembers),
    [previewPersonaId, audienceMembers],
  );

  const messageTemplateId = campaign?.messageTemplateId ?? null;

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
    if (!editable || !campaign) return;
    try {
      if (!template) {
        const updated = await scaleApi.updateCampaign(campaignId, { messageTemplateId: null });
        setCampaign(updated);
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
      ingestBody(template.bodyMarkdown, campaignId);
      const updated = await scaleApi.updateCampaign(campaignId, {
        messageTemplateId: template.id,
        subject: template.subject,
        bodyMarkdown: template.bodyMarkdown,
        layoutId: template.layoutId ?? undefined,
      });
      setCampaign(updated);
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
    if (!campaign || !editable) return;
    const timer = setTimeout(() => {
      void persistDraft();
    }, 3000);
    return () => clearTimeout(timer);
  }, [subject, templateId, templateVariables, campaign, editable, persistDraft]);

  const template = templates.find((t) => t.id === templateId);
  const plainTextTemplate = isPlainTextTemplate(templateId);
  const previewMergeOptions = useMemo(
    () => ({
      unsubscribeUrl: buildPreviewUnsubscribeUrl(campaignId, previewPersonaId, audienceMembers),
      compliancePreviewPlaceholders: true,
      compliancePlaceholderFormat: (plainTextTemplate ? "plain" : "html") as "plain" | "html",
      compliance: {
        organizationName: compliance?.organizationName ?? null,
        postalAddress: compliance?.postalAddress ?? null,
        complianceContactEmail: compliance?.contactEmail ?? null,
      },
    }),
    [campaignId, previewPersonaId, audienceMembers, compliance, plainTextTemplate],
  );

  const previewSubject = useMemo(
    () => applyCampaignMergeTags(subject, previewRecipient, previewMergeOptions),
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
      const body = bodyMarkdown.trim() || "Nothing to preview yet";
      const wrapped = preparedTemplateHtml.replaceAll("{{content}}", body);
      return applyCampaignMergeTags(wrapped, previewRecipient, previewMergeOptions);
    }
    const content = previewHtml || "<p style='color:#94a3b8'>Nothing to preview yet</p>";
    if (!template) {
      return applyCampaignMergeTags(content, previewRecipient, previewMergeOptions);
    }
    const wrapped = preparedTemplateHtml.replaceAll("{{content}}", content);
    return applyCampaignMergeTags(wrapped, previewRecipient, previewMergeOptions);
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
    if (saved) toast.success("Campaign saved");
    else toast.error("Could not save campaign");
  }

  async function handleDuplicate() {
    setDuplicating(true);
    try {
      const duplicate = await scaleApi.duplicateCampaign(campaignId);
      router.push(campaignDetailHref(duplicate.id, "content"));
    } catch {
      toast.error("Could not duplicate campaign");
      setDuplicating(false);
    }
  }

  if (!campaign) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {!editable ? (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-2">
          <p className="text-xs text-muted-foreground">
            {lockedCampaignMessage(campaign.status, campaign.scheduledAt, campaign.sentAt)}
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
      <CampaignComposeForm
        campaignId={campaignId}
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
            if (prev !== markdown) ingestBody(markdown, campaignId);
            return markdown;
          });
        }}
        renderedPreview={renderedPreview}
        previewSubject={previewSubject}
        previewFromName={campaign.fromName}
        previewFromEmail={campaign.fromEmail ?? "you@example.com"}
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
        complianceIdentityId={campaign.complianceIdentityId ?? null}
        accountDefaultComplianceIdentityId={accountDefaultComplianceIdentityId}
        onComplianceIdentityChange={async (id) => {
          const updated = await scaleApi.updateCampaign(campaignId, {
            complianceIdentityId: id,
          });
          setCampaign(updated);
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
