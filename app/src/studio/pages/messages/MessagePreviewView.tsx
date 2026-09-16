"use client";

import { useEffect, useRef, useState } from "react";

import { NewsletterEmailPreview } from "@/studio/components/newsletters/NewsletterEmailPreview";
import { useMessageDetail } from "@/studio/pages/messages/MessageDetailContext";
import { useTemplatePreviewDevice } from "@/studio/pages/messages/MessagePreviewShell";
import { useMessageRenderedPreview } from "@/studio/pages/messages/use-message-rendered-preview";
import MarkdownEditor from "@/lib/markdown-editor/components/MarkdownEditor";

const PREVIEW_FROM = {
  name: "Your organization",
  email: "hello@yourdomain.com",
};

export function MessagePreviewView() {
  const { messageId, message, layouts } = useMessageDetail();
  const { device } = useTemplatePreviewDevice();
  const [previewHtml, setPreviewHtml] = useState("");
  const editorRef = useRef(null);

  const subject = message?.subject ?? "";
  const bodyMarkdown = message?.bodyMarkdown ?? "";
  const templateId = message?.layoutId ?? layouts[0]?.id ?? "";
  const templateVariables = message?.templateVariables ?? {};

  const { plainTextTemplate, previewSubject, renderedPreview, PREVIEW_RECIPIENT } =
    useMessageRenderedPreview({
      messageId,
      layouts,
      subject,
      bodyMarkdown,
      previewHtml,
      templateId,
      templateVariables,
    });

  useEffect(() => {
    setPreviewHtml("");
  }, [messageId, bodyMarkdown, templateId]);

  if (!message) return null;

  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden">
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {!plainTextTemplate ? (
          <div className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0" aria-hidden>
            <MarkdownEditor
              key={messageId}
              ref={editorRef}
              newsletterId={messageId}
              documentId={messageId}
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
