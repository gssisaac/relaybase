"use client";

import Link from "next/link";
import { Monitor, Pencil, Smartphone } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { BroadcastEmailPreview } from "@/scale/components/BroadcastEmailPreview";
import { automationContentEditHref } from "@/scale/lib/paths";
import { useAutomationDetail } from "@/scale/pages/automations/AutomationDetailContext";
import { useAutomationRenderedPreview } from "@/scale/pages/automations/use-automation-rendered-preview";
import MarkdownEditor from "@/lib/markdown-editor/components/MarkdownEditor";

export function AutomationPreviewView() {
  const { automationId, automation, templates } = useAutomationDetail();
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [previewHtml, setPreviewHtml] = useState("");
  const editorRef = useRef(null);

  const subject = automation?.subject ?? "";
  const bodyMarkdown = automation?.bodyMarkdown ?? "";
  const templateId = automation?.templateId ?? templates[0]?.id ?? "";
  const templateVariables = automation?.templateVariables ?? {};

  const { plainTextTemplate, previewSubject, renderedPreview, PREVIEW_RECIPIENT } =
    useAutomationRenderedPreview({
      automationId,
      automation,
      templates,
      subject,
      bodyMarkdown,
      previewHtml,
      templateId,
      templateVariables,
    });

  useEffect(() => {
    setPreviewHtml("");
  }, [automationId, bodyMarkdown, templateId]);

  if (!automation) return null;

  const editable = automation.listStatus !== "archived";

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {!plainTextTemplate ? (
        <div className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0" aria-hidden>
          <MarkdownEditor
            ref={editorRef}
            campaignId={automationId}
            documentId={automationId}
            assetOwner="automation"
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
            render={<Link href={automationContentEditHref(automationId)} />}
          >
            <Pencil className="size-3.5" aria-hidden />
            Edit
          </Button>
        ) : null}
      </div>

      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f6f8fc]"
        style={{ colorScheme: "light" }}
      >
        <BroadcastEmailPreview
          subject={previewSubject}
          fromName={automation.fromName}
          fromEmail={automation.fromEmail ?? "you@example.com"}
          toEmail={PREVIEW_RECIPIENT.email}
          bodyHtml={renderedPreview}
          bodyPlainText={renderedPreview}
          previewIsPlainText={plainTextTemplate}
          device={device}
        />
      </div>
    </div>
  );
}
