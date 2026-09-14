"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { CampaignComposeForm } from "@/crm/pages/campaigns/CampaignComposeForm";
import { useCampaignDetail } from "@/crm/pages/campaigns/CampaignDetailContext";
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

export function CampaignContentView() {
  const {
    campaignId,
    campaign,
    templates,
    syncDraft,
    persistDraft,
    getLastSavedDraft,
  } = useCampaignDetail();

  const [subject, setSubject] = useState(campaign?.subject ?? "");
  const [bodyMarkdown, setBodyMarkdown] = useState(campaign?.bodyMarkdown ?? "");
  const [previewHtml, setPreviewHtml] = useState("");
  const [templateId, setTemplateId] = useState(
    campaign?.templateId ?? templates[0]?.id ?? "",
  );
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  const editable = campaign?.status === "draft" || campaign?.status === "failed";

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
    [subject, bodyMarkdown, templateId, getLastSavedDraft, persistDraft],
  );

  const { editorRef, ingestBody, checkpoint, saveStatus } = useCampaignEditorPersistence({
    campaignId,
    editable: Boolean(editable),
    bridge,
  });

  const saveState = mapSaveStatus(saveStatus);

  useEffect(() => {
    syncDraft({ subject, bodyMarkdown, templateId });
  }, [subject, bodyMarkdown, templateId, syncDraft]);

  useEffect(() => {
    if (!campaign || !editable) return;
    const timer = setTimeout(() => {
      void persistDraft();
    }, 3000);
    return () => clearTimeout(timer);
  }, [subject, templateId, campaign, editable, persistDraft]);

  const template = templates.find((t) => t.id === templateId);
  const renderedPreview = useMemo(() => {
    const content = previewHtml || "<p style='color:#94a3b8'>Nothing to preview yet</p>";
    if (!template) return content;
    return template.htmlSource
      .replaceAll("{{content}}", content)
      .replaceAll("{{unsubscribe_url}}", "#")
      .replaceAll("{{contact.name}}", "there")
      .replaceAll("{{contact.email}}", "you@example.com");
  }, [template, previewHtml]);

  async function handleSave() {
    await checkpoint("manual-save");
    const saved = await persistDraft();
    if (saved) toast.success("Campaign saved");
    else toast.error("Could not save campaign");
  }

  if (!campaign) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <CampaignComposeForm
        campaignId={campaignId}
        editorRef={editorRef}
        templates={templates}
        templateId={templateId}
        setTemplateId={setTemplateId}
        subject={subject}
        setSubject={setSubject}
        bodyMarkdown={bodyMarkdown}
        onBodyChange={({ markdown, html }) => {
          setBodyMarkdown(markdown);
          setPreviewHtml(html);
          ingestBody(markdown, campaignId);
        }}
        renderedPreview={renderedPreview}
        device={device}
        setDevice={setDevice}
        editable={Boolean(editable)}
        saveState={saveState}
        onSave={() => void handleSave()}
      />
    </div>
  );
}
