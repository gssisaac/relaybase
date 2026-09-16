"use client";

import { Monitor, Pencil, Smartphone } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NewsletterEmailPreview } from "@/studio/components/newsletters/NewsletterEmailPreview";
import { triggerContentEditHref } from "@/studio/lib/paths";
import { useTriggerDetail } from "@/studio/pages/triggers/TriggerDetailContext";
import { useTriggerRenderedPreview } from "@/studio/pages/triggers/use-trigger-rendered-preview";
import MarkdownEditor from "@/lib/markdown-editor/components/MarkdownEditor";

export function TriggerPreviewDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { triggerId, trigger, templates } = useTriggerDetail();
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [previewHtml, setPreviewHtml] = useState("");
  const editorRef = useRef(null);

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
    if (!open) return;
    setPreviewHtml("");
  }, [open, triggerId, bodyMarkdown, templateId]);

  if (!trigger) return null;

  const editable = trigger.listStatus !== "archived";
  const previewFromEmail = trigger.fromEmail ?? "you@example.com";
  const previewFromName = trigger.fromName;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(85vh,720px)] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="shrink-0 space-y-0 border-b border-border px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2 pr-8">
            <DialogTitle className="text-sm font-semibold">Email preview</DialogTitle>
            <div className="flex items-center gap-1">
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
              {editable ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-1"
                  nativeButton={false}
                  render={<Link href={triggerContentEditHref(triggerId)} />}
                >
                  <Pencil className="size-3.5" aria-hidden />
                  Edit
                </Button>
              ) : null}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Sample recipient · {PREVIEW_RECIPIENT.email}
          </p>
        </DialogHeader>

        {!plainTextTemplate ? (
          <div className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0" aria-hidden>
            <MarkdownEditor
              ref={editorRef}
              newsletterId={triggerId}
              documentId={triggerId}
              assetOwner="trigger"
              value={bodyMarkdown}
              editable={false}
              onChange={({ html }) => setPreviewHtml(html)}
            />
          </div>
        ) : null}

        <div
          className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f6f8fc]"
          style={{ colorScheme: "light" }}
        >
          <NewsletterEmailPreview
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
      </DialogContent>
    </Dialog>
  );
}
