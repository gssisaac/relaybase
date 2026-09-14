"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { BroadcastComposeForm } from "@/crm/pages/campaigns/BroadcastComposeForm";
import { useBroadcastDetail } from "@/crm/pages/campaigns/CampaignDetailContext";
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

export function BroadcastContentView() {
  const { broadcastId, broadcast, templates, syncDraft, persistDraft, getLastSavedDraft } =
    useBroadcastDetail();

  const [subject, setSubject] = useState(broadcast?.subject ?? "");
  const [bodyMarkdown, setBodyMarkdown] = useState(broadcast?.bodyMarkdown ?? "");
  const [previewHtml, setPreviewHtml] = useState("");
  const [templateId, setTemplateId] = useState(broadcast?.templateId ?? templates[0]?.id ?? "");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  const editable = broadcast?.status === "draft";

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
    campaignId: broadcastId,
    beaconPath: `broadcasts/${broadcastId}`,
    editable: Boolean(editable),
    bridge,
  });

  const saveState = mapSaveStatus(saveStatus);

  useEffect(() => {
    setPreviewHtml("");
  }, [broadcastId]);

  useEffect(() => {
    syncDraft({ subject, bodyMarkdown, templateId });
  }, [subject, bodyMarkdown, templateId, syncDraft]);

  useEffect(() => {
    if (!broadcast || !editable) return;
    const timer = setTimeout(() => {
      void persistDraft();
    }, 3000);
    return () => clearTimeout(timer);
  }, [subject, templateId, broadcast, editable, persistDraft]);

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
    if (saved) toast.success("Broadcast saved");
    else toast.error("Could not save broadcast");
  }

  if (!broadcast) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {!editable ? (
        <div className="shrink-0 border-b border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
          This broadcast was sent on{" "}
          {broadcast.sentAt ? new Date(broadcast.sentAt).toLocaleDateString() : "an earlier date"} and is
          locked. Duplicate it as a new draft to reuse this content.
        </div>
      ) : null}
      <BroadcastComposeForm
        broadcastId={broadcastId}
        editorRef={editorRef}
        templates={templates}
        templateId={templateId}
        setTemplateId={setTemplateId}
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
        device={device}
        setDevice={setDevice}
        editable={Boolean(editable)}
        saveState={saveState}
        onSave={() => void handleSave()}
      />
    </div>
  );
}
