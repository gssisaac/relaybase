"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { broadcastDetailHref } from "@/crm/lib/paths";

import {
  applyBroadcastMergeTags,
  previewPersonaOptions,
  resolvePreviewRecipient,
  type PreviewPersonaId,
} from "@/crm/lib/broadcast-merge-tags";
import {
  applyTemplateVariablesToHtml,
  resolveTemplateVariableDefaults,
} from "@/crm/lib/broadcast-template-variables";
import { prepareBroadcastTemplateHtml } from "@/crm/lib/broadcast-standard-footer";
import { isPlainTextTemplate } from "@/crm/lib/broadcast-templates";
import { BroadcastComposeForm } from "@/crm/pages/campaigns/BroadcastComposeForm";
import { useBroadcastDetail } from "@/crm/pages/campaigns/CampaignDetailContext";
import {
  complianceFromIdentity,
  effectiveComplianceIdentityId,
  findComplianceIdentityById,
} from "@/crm/lib/compliance-identity";
import { buildPreviewUnsubscribeUrl } from "@/crm/lib/preview-unsubscribe-url";
import { crmApi, type BroadcastStatus, type CrmAccountCompliance } from "@/lib/crm/api";
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

function lockedBroadcastMessage(
  status: BroadcastStatus,
  scheduledAt: string | null | undefined,
  sentAt: string | null | undefined,
): string {
  if (status === "scheduled" && scheduledAt) {
    return `This broadcast is scheduled for ${new Date(scheduledAt).toLocaleString()} and is locked.`;
  }
  if (status === "sending") {
    return "This broadcast is currently sending and is locked.";
  }
  if (status === "failed") {
    return "This broadcast failed to send and is locked.";
  }
  return `This broadcast was sent on ${sentAt ? new Date(sentAt).toLocaleDateString() : "an earlier date"} and is locked.`;
}

export function BroadcastContentView() {
  const router = useRouter();
  const {
    broadcastId,
    broadcast,
    templates,
    audienceMembers,
    syncDraft,
    persistDraft,
    getLastSavedDraft,
    refreshTemplates,
    setBroadcast,
  } = useBroadcastDetail();

  const [compliance, setCompliance] = useState<CrmAccountCompliance | null>(null);
  const [accountDefaultComplianceIdentityId, setAccountDefaultComplianceIdentityId] = useState<
    string | null
  >(null);
  const [subject, setSubject] = useState(broadcast?.subject ?? "");
  const [bodyMarkdown, setBodyMarkdown] = useState(broadcast?.bodyMarkdown ?? "");
  const [previewHtml, setPreviewHtml] = useState("");
  const [templateId, setTemplateId] = useState(broadcast?.templateId ?? templates[0]?.id ?? "");
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>(
    broadcast?.templateVariables ?? {},
  );
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [previewPersonaId, setPreviewPersonaId] = useState<PreviewPersonaId>("sample-named");
  const [duplicating, setDuplicating] = useState(false);

  const editable = broadcast?.status === "draft";

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
    campaignId: broadcastId,
    beaconPath: `broadcasts/${broadcastId}`,
    editable: Boolean(editable),
    bridge,
  });

  const saveState = mapSaveStatus(saveStatus);

  useEffect(() => {
    setPreviewHtml("");
    setPreviewPersonaId("sample-named");
  }, [broadcastId]);

  useEffect(() => {
    if (!broadcast) return;
    setTemplateVariables(broadcast.templateVariables ?? {});
  }, [broadcast?.id, broadcast?.templateVariables]);

  const refreshComplianceContext = useCallback(async () => {
    try {
      const res = await crmApi.listComplianceIdentities();
      setAccountDefaultComplianceIdentityId(res.defaultComplianceIdentityId);
      const effectiveId = effectiveComplianceIdentityId(
        broadcast?.complianceIdentityId,
        res.defaultComplianceIdentityId,
      );
      setCompliance(complianceFromIdentity(findComplianceIdentityById(res.identities, effectiveId)));
    } catch {
      setCompliance(null);
    }
  }, [broadcast?.complianceIdentityId]);

  useEffect(() => {
    void refreshComplianceContext();
  }, [refreshComplianceContext, broadcastId]);

  const personaOptions = useMemo(
    () => previewPersonaOptions(audienceMembers),
    [audienceMembers],
  );

  const previewRecipient = useMemo(
    () => resolvePreviewRecipient(previewPersonaId, audienceMembers),
    [previewPersonaId, audienceMembers],
  );

  useEffect(() => {
    syncDraft({ subject, bodyMarkdown, templateId, templateVariables });
  }, [subject, bodyMarkdown, templateId, templateVariables, syncDraft]);

  useEffect(() => {
    if (!broadcast || !editable) return;
    const timer = setTimeout(() => {
      void persistDraft();
    }, 3000);
    return () => clearTimeout(timer);
  }, [subject, templateId, templateVariables, broadcast, editable, persistDraft]);

  const template = templates.find((t) => t.id === templateId);
  const plainTextTemplate = isPlainTextTemplate(templateId);
  const previewMergeOptions = useMemo(
    () => ({
      unsubscribeUrl: buildPreviewUnsubscribeUrl(broadcastId, previewPersonaId, audienceMembers),
      compliancePreviewPlaceholders: true,
      compliancePlaceholderFormat: (plainTextTemplate ? "plain" : "html") as "plain" | "html",
      compliance: {
        organizationName: compliance?.organizationName ?? null,
        postalAddress: compliance?.postalAddress ?? null,
        complianceContactEmail: compliance?.contactEmail ?? null,
      },
    }),
    [broadcastId, previewPersonaId, audienceMembers, compliance, plainTextTemplate],
  );

  const previewSubject = useMemo(
    () => applyBroadcastMergeTags(subject, previewRecipient, previewMergeOptions),
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
      return applyBroadcastMergeTags(wrapped, previewRecipient, previewMergeOptions);
    }
    const content = previewHtml || "<p style='color:#94a3b8'>Nothing to preview yet</p>";
    if (!template) {
      return applyBroadcastMergeTags(content, previewRecipient, previewMergeOptions);
    }
    const wrapped = preparedTemplateHtml.replaceAll("{{content}}", content);
    return applyBroadcastMergeTags(wrapped, previewRecipient, previewMergeOptions);
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
    if (saved) toast.success("Broadcast saved");
    else toast.error("Could not save broadcast");
  }

  async function handleDuplicate() {
    setDuplicating(true);
    try {
      const duplicate = await crmApi.duplicateBroadcast(broadcastId);
      router.push(broadcastDetailHref(duplicate.id, "content"));
    } catch {
      toast.error("Could not duplicate broadcast");
      setDuplicating(false);
    }
  }

  if (!broadcast) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {!editable ? (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-2">
          <p className="text-xs text-muted-foreground">
            {lockedBroadcastMessage(broadcast.status, broadcast.scheduledAt, broadcast.sentAt)}
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
      <BroadcastComposeForm
        broadcastId={broadcastId}
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
            if (prev !== markdown) ingestBody(markdown, broadcastId);
            return markdown;
          });
        }}
        renderedPreview={renderedPreview}
        previewSubject={previewSubject}
        previewFromName={broadcast.fromName}
        previewFromEmail={broadcast.fromEmail ?? "you@example.com"}
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
        complianceIdentityId={broadcast.complianceIdentityId ?? null}
        accountDefaultComplianceIdentityId={accountDefaultComplianceIdentityId}
        onComplianceIdentityChange={async (id) => {
          const updated = await crmApi.updateBroadcast(broadcastId, {
            complianceIdentityId: id,
          });
          setBroadcast(updated);
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
