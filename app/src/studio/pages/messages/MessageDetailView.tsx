"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { dashboardScrollBodyClassName } from "@/console/lib/page-layout";
import { StudioDetailPageHeader } from "@/studio/components/StudioDetailPageHeader";
import { messagePreviewHref } from "@/studio/lib/message-paths";
import { MessageContentView } from "@/studio/pages/messages/MessageContentView";
import { TemplateEditableTitle } from "@/studio/pages/messages/TemplateEditableTitle";
import {
  MessageDetailProvider,
  useMessageDetail,
} from "@/studio/pages/messages/MessageDetailContext";
import {
  TemplateEditChromeProvider,
  useTemplateEditChrome,
} from "@/studio/pages/messages/template-edit-chrome";

function TemplateDetailBody() {
  const { messageId, message, loading, notFound } = useMessageDetail();
  const { name, setName, subjectFallback, saveState, requestSave } = useTemplateEditChrome();
  const previewHref = messagePreviewHref(messageId);

  if (loading && !message) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <StudioDetailPageHeader backHref={previewHref} backLabel="Back to preview" title="Loading…" />
        <div className={dashboardScrollBodyClassName("text-sm text-muted-foreground")}>
          Loading message…
        </div>
      </div>
    );
  }

  if (notFound || !message) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <StudioDetailPageHeader
          backHref={previewHref}
          backLabel="Back to preview"
          title="Template not found"
        />
        <div className={dashboardScrollBodyClassName("text-sm text-muted-foreground")}>
          This template does not exist or was removed.{" "}
          <Link href={previewHref} className="text-primary underline-offset-4 hover:underline">
            Back to preview
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <StudioDetailPageHeader
        backHref={previewHref}
        backLabel="Back to preview"
        titleNode={
          <div className="min-w-0 flex-1">
            <TemplateEditableTitle
              value={name}
              onChange={setName}
              subjectFallback={subjectFallback}
            />
          </div>
        }
        end={
          <Button
            size="sm"
            disabled={saveState === "saving"}
            onClick={() => void requestSave()}
          >
            {saveState === "saving" ? "Saving…" : "Save"}
          </Button>
        }
      />
      <MessageContentView />
    </div>
  );
}

export function MessageDetailView({ messageId }: { messageId: string }) {
  return (
    <MessageDetailProvider messageId={messageId}>
      <TemplateEditChromeProvider>
        <TemplateDetailBody />
      </TemplateEditChromeProvider>
    </MessageDetailProvider>
  );
}
