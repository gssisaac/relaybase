"use client";

import { Monitor, Smartphone } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import MarkdownEditor from "@/lib/markdown-editor/components/MarkdownEditor";
import type { StudioLayout, StudioTemplate } from "@/studio/api";
import { CatalogTemplateUseActions } from "@/studio/components/templates/CatalogTemplateUseActions";
import { NewsletterEmailPreview } from "@/studio/components/newsletters/NewsletterEmailPreview";
import { plainEmailBodyFromMarkdown } from "@/studio/lib/markdown/markdown-to-plain-email-text";
import { useCatalogTemplateRenderedPreview } from "@/studio/lib/templates/use-catalog-template-rendered-preview";

export function CatalogTemplatePreviewDialog({
  template,
  layouts,
  open,
  onOpenChange,
}: {
  template: StudioTemplate | null;
  layouts: StudioLayout[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [previewHtml, setPreviewHtml] = useState("");
  const editorRef = useRef(null);

  const bodyMarkdown = template?.bodyMarkdown ?? "";

  const { plainTextTemplate, previewSubject, renderedPreview, PREVIEW_RECIPIENT } =
    useCatalogTemplateRenderedPreview({
      template,
      layouts,
      previewHtml,
    });

  useEffect(() => {
    if (!open) return;
    setPreviewHtml("");
  }, [open, template?.id, bodyMarkdown, template?.layoutId]);

  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(85vh,720px)] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="shrink-0 space-y-0 border-b border-border px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2 pr-8">
            <div className="min-w-0">
              <DialogTitle className="truncate text-sm font-semibold">{template.name}</DialogTitle>
              <p className="truncate text-xs text-muted-foreground">{template.subject}</p>
            </div>
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
              <div className="ml-1">
                <CatalogTemplateUseActions template={template} />
              </div>
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
              newsletterId={template.id}
              documentId={template.id}
              assetOwner="message"
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
            fromName={null}
            fromEmail="you@example.com"
            toEmail={PREVIEW_RECIPIENT.email}
            bodyHtml={renderedPreview}
            bodyPlainText={plainEmailBodyFromMarkdown(bodyMarkdown)}
            previewIsPlainText={plainTextTemplate}
            device={device}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
