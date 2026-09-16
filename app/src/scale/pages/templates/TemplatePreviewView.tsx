"use client";

import { useEffect, useRef, useState } from "react";

import { NewsletterEmailPreview } from "@/scale/components/newsletters/NewsletterEmailPreview";
import { useTemplateDetail } from "@/scale/pages/templates/TemplateDetailContext";
import { useTemplatePreviewDevice } from "@/scale/pages/templates/TemplatePreviewShell";
import { useTemplateRenderedPreview } from "@/scale/pages/templates/use-template-rendered-preview";
import MarkdownEditor from "@/lib/markdown-editor/components/MarkdownEditor";

const PREVIEW_FROM = {
  name: "Your organization",
  email: "hello@yourdomain.com",
};

export function TemplatePreviewView() {
  const { messageTemplateId, template, layouts } = useTemplateDetail();
  const { device } = useTemplatePreviewDevice();
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

        <div
          className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f6f8fc]"
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
