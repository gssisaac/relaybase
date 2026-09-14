"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { CampaignComposeForm } from "@/crm/pages/campaigns/CampaignComposeForm";
import { useCampaignDetail } from "@/crm/pages/campaigns/CampaignDetailContext";

const AUTOSAVE_DELAY_MS = 3000;

export function CampaignContentView() {
  const { campaignId, campaign, templates, syncDraft, persistDraft } = useCampaignDetail();

  const [subject, setSubject] = useState(campaign?.subject ?? "");
  const [bodyMarkdown, setBodyMarkdown] = useState(campaign?.bodyMarkdown ?? "");
  const [previewHtml, setPreviewHtml] = useState("");
  const [templateId, setTemplateId] = useState(
    campaign?.templateId ?? templates[0]?.id ?? "",
  );
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">("idle");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  const editable = campaign?.status === "draft" || campaign?.status === "failed";

  useEffect(() => {
    syncDraft({ subject, bodyMarkdown, templateId });
  }, [subject, bodyMarkdown, templateId, syncDraft]);

  useEffect(() => {
    return () => {
      void persistDraft();
    };
  }, [persistDraft]);

  useEffect(() => {
    if (!campaign || !editable) return;
    const timer = setTimeout(() => {
      setSaveState("saving");
      void persistDraft().then((ok) => setSaveState(ok ? "idle" : "error"));
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [subject, bodyMarkdown, templateId, campaign, editable, persistDraft]);

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
    setSaveState("saving");
    const saved = await persistDraft();
    setSaveState(saved ? "idle" : "error");
    if (saved) toast.success("Campaign saved");
    else toast.error("Could not save campaign");
  }

  if (!campaign) return null;

  return (
    <CampaignComposeForm
      campaignId={campaignId}
      templates={templates}
      templateId={templateId}
      setTemplateId={setTemplateId}
      subject={subject}
      setSubject={setSubject}
      bodyMarkdown={bodyMarkdown}
      onBodyChange={({ markdown, html }) => {
        setBodyMarkdown(markdown);
        setPreviewHtml(html);
      }}
      renderedPreview={renderedPreview}
      device={device}
      setDevice={setDevice}
      editable={Boolean(editable)}
      saveState={saveState}
      onSave={() => void handleSave()}
    />
  );
}
