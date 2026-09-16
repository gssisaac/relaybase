"use client";

import Link from "next/link";
import { Monitor, Pencil, Smartphone } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { NewsletterEmailPreview } from "@/scale/components/newsletters/NewsletterEmailPreview";
import { messageTemplateEditHref } from "@/scale/lib/template-paths";
import { useTemplateDetail } from "@/scale/pages/templates/TemplateDetailContext";
import { useTemplateRenderedPreview } from "@/scale/pages/templates/use-template-rendered-preview";
import MarkdownEditor from "@/lib/markdown-editor/components/MarkdownEditor";

const PREVIEW_FROM = {
  name: "Your organization",
  email: "hello@yourdomain.com",
};

export function TemplatePreviewView() {
  const { messageTemplateId, template, layouts } = useTemplateDetail();
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [previewHtml, setPreviewHtml] = useState("");
  const editorRef = useRef(null);

  const subject = template?.subject ?? "";
  const bodyMarkdown = template?.bodyMarkdown ?? "";
  const templateId = template?.layoutId ?? layouts[0]?.id ?? "";
  const templateVariables = template?.templateVariables ?? {};

  const { plainTextTemplate, previewSubject, renderedPreview, PREVIEW_RECIPIENT } =
    useTemplateRenderedPreview({
      messageTemplateId,
      layouts,
      subject,
      bodyMarkdown,
      previewHtml,
      templateId,
      templateVariables,
    });

  useEffect(() => {
    setPreviewHtml("");
  }, [messageTemplateId, bodyMarkdown, templateId]);

  if (!template) return null;

  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden">
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {!plainTextTemplate ? (
          <div className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0" aria-hidden>
            <MarkdownEditor
              ref={editorRef}
              newsletterId={messageTemplateId}
              documentId={messageTemplateId}
              assetOwner="template"
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
          <Button
            size="sm"
            className="absolute right-3 top-1/2 -translate-y-1/2"
            nativeButton={false}
            render={<Link href={messageTemplateEditHref(messageTemplateId)} />}
          >
            <Pencil className="size-3.5" aria-hidden />
            Edit
          </Button>
        </div>

        <div
          className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-border bg-[#f6f8fc]"
          style={{ colorScheme: "light" }}
        >
          <NewsletterEmailPreview
            subject={previewSubject}
            fromName={PREVIEW_FROM.name}
            fromEmail={PREVIEW_FROM.email}
            toEmail={PREVIEW_RECIPIENT.email}
            bodyHtml={renderedPreview}
            bodyPlainText={renderedPreview}
            previewIsPlainText={plainTextTemplate}
            device={device}
          />
        </div>
      </div>
    </div>
  );
}
