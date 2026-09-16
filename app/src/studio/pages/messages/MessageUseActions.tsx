"use client";

import { toast } from "sonner";

import { studioApi } from "@/lib/studio/api";
import { HubTemplateUseMenu } from "@/studio/components/templates/HubTemplateUseMenu";
import type { HubTemplateSnapshot } from "@/studio/lib/templates/hub-template-launch";
import { useMessageDetail } from "@/studio/pages/messages/MessageDetailContext";

function snapshotFromDraft(draft: {
  subject: string;
  previewText: string;
  bodyMarkdown: string;
  templateId: string;
  templateVariables: Record<string, string>;
}): HubTemplateSnapshot {
  return {
    subject: draft.subject,
    previewText: draft.previewText,
    bodyMarkdown: draft.bodyMarkdown,
    layoutId: draft.templateId,
    templateVariables: draft.templateVariables,
  };
}

export function MessageUseActions() {
  const { messageId, message, persistDraft, getDraft } = useMessageDetail();

  const defaultTitle =
    message?.name.trim() || message?.subject.trim() || "Untitled template";

  const draft = getDraft();

  return (
    <div className="flex shrink-0 items-center gap-2">
      <HubTemplateUseMenu
        defaultTitle={defaultTitle}
        hubTemplateId={messageId}
        mergeTagSource={{
          subject: draft.subject,
          bodyMarkdown: draft.bodyMarkdown,
        }}
        resolveSnapshot={async () => {
          const saved = await persistDraft();
          if (!saved) {
            toast.error("Could not save template");
            return null;
          }
          return snapshotFromDraft(getDraft());
        }}
        runTestSend={async (input) => {
          const saved = await persistDraft();
          if (!saved) {
            toast.error("Could not save template");
            throw new Error("save failed");
          }
          await studioApi.testSendMessage(messageId, input);
        }}
      />
    </div>
  );
}
