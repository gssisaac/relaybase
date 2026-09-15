"use client";

import Link from "next/link";
import { Monitor, Pencil, Smartphone } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { CampaignEmailPreview } from "@/scale/components/campaigns/CampaignEmailPreview";
import { triggerContentEditHref } from "@/scale/lib/paths";
import {
  TriggerOutboundSenderPanel,
  type OutboundSenderDraft,
} from "@/scale/pages/triggers/TriggerOutboundSenderPanel";
import { useTriggerDetail } from "@/scale/pages/triggers/TriggerDetailContext";
import { useTriggerRenderedPreview } from "@/scale/pages/triggers/use-trigger-rendered-preview";
import MarkdownEditor from "@/lib/markdown-editor/components/MarkdownEditor";

export function TriggerPreviewView() {
  const { triggerId, trigger, templates } = useTriggerDetail();
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [previewHtml, setPreviewHtml] = useState("");
  const editorRef = useRef(null);
  const [senderDraft, setSenderDraft] = useState<OutboundSenderDraft>({
    fromName: null,
    fromEmail: null,
    replyTo: null,
  });

  const subject = trigger?.subject ?? "";
  const bodyMarkdown = trigger?.bodyMarkdown ?? "";
  const templateId = trigger?.layoutId ?? templates[0]?.id ?? "";
  const templateVariables = trigger?.templateVariables ?? {};

  const { plainTextTemplate, previewSubject, renderedPreview, PREVIEW_RECIPIENT } =
    useTriggerRenderedPreview({
      triggerId,
      trigger,
      templates,
      subject,
      bodyMarkdown,
      previewHtml,
      templateId,
      templateVariables,
    });

  useEffect(() => {
    setPreviewHtml("");
  }, [triggerId, bodyMarkdown, templateId]);

  useEffect(() => {
    if (!trigger) return;
    setSenderDraft({
      fromName: trigger.fromName ?? null,
      fromEmail: trigger.fromEmail ?? null,
      replyTo: trigger.replyTo ?? null,
    });
  }, [
    trigger?.id,
    trigger?.fromName,
    trigger?.fromEmail,
    trigger?.replyTo,
    trigger,
  ]);

  if (!trigger) return null;

  const editable = trigger.listStatus !== "archived";
  const previewFromEmail = senderDraft.fromEmail ?? trigger.fromEmail ?? "you@example.com";
  const previewFromName = senderDraft.fromName ?? trigger.fromName;

  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden">
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {!plainTextTemplate ? (
          <div className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0" aria-hidden>
            <MarkdownEditor
              ref={editorRef}
              campaignId={triggerId}
              documentId={triggerId}
              assetOwner="trigger"
              value={bodyMarkdown}
              editable={false}
              onChange={({ html }) => setPreviewHtml(html)}
            />
          </div>
        ) : null}

        <div className="relative flex shrink-0 items-center justify-center border-b border-border px-3 py-2">
          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              size="icon-sm"
              variant={device === "desktop" ? "secondary" : "ghost"}
              aria-label="Desktop preview"
              aria-pressed={device === "desktop"}
              onClick={() => setDevice("desktop")}
            >
              <Monitor className="size-4" />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant={device === "mobile" ? "secondary" : "ghost"}
              aria-label="Mobile preview"
              aria-pressed={device === "mobile"}
              onClick={() => setDevice("mobile")}
            >
              <Smartphone className="size-4" />
            </Button>
          </div>
          {editable ? (
            <Button
              size="sm"
              className="absolute right-3 top-1/2 -translate-y-1/2"
              nativeButton={false}
              render={<Link href={triggerContentEditHref(triggerId)} />}
            >
              <Pencil className="size-3.5" aria-hidden />
              Edit
            </Button>
          ) : null}
        </div>

        <div
          className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-border bg-[#f6f8fc]"
          style={{ colorScheme: "light" }}
        >
          <CampaignEmailPreview
            subject={previewSubject}
            fromName={previewFromName}
            fromEmail={previewFromEmail}
            toEmail={PREVIEW_RECIPIENT.email}
            bodyHtml={renderedPreview}
            bodyPlainText={renderedPreview}
            previewIsPlainText={plainTextTemplate}
            device={device}
          />
        </div>
      </div>

      <TriggerOutboundSenderPanel
        draft={senderDraft}
        disabled={!editable}
        onDraftChange={(patch) => setSenderDraft((prev) => ({ ...prev, ...patch }))}
      />
    </div>
  );
}
