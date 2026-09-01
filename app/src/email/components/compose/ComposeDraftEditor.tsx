"use client";

import { useMemo, useRef, type ReactNode } from "react";

import { ComposeForm } from "@/email/components/compose/ComposeForm";
import { useEmailMailbox } from "@/email/components/mailbox/EmailMailboxContext";
import type { Address } from "@/email/components/mailbox/types";
import {
  useComposeDraftController,
  type ComposeDraftFields,
  type ComposeDraftMode,
  type ComposeDraftThreading,
} from "@/email/components/compose/useComposeDraftController";
import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import { useEmailPaths } from "@/email/lib/paths";

export type ComposeDraftEditorProps = {
  /** Existing draft id, or null/undefined for a new compose. */
  draftId?: string | null;
  initial: ComposeDraftFields;
  reply?: {
    replyKey: string;
    replyAll: boolean;
    threading?: ComposeDraftThreading;
  };
  /** When set on a standalone/forward compose, ties the draft to an inbox message. */
  forwardKey?: string;
  /** Threading headers for standalone compose (legacy URL params). */
  threading?: ComposeDraftThreading;
  addresses: Address[];
  fromFallbacks?: string[];
  allowFromSelect?: boolean;
  compact?: boolean;
  /** Focus body textarea on mount (inline reply). */
  autoFocusBody?: boolean;
  /** Focus To field on mount (new standalone compose). */
  autoFocusTo?: boolean;
  skipAutosaveWhenEmpty?: boolean;
  navigateOnSendStart?: boolean;
  /** When false, discard is hidden until there is content or a draft id. */
  alwaysShowDiscard?: boolean;
  onAfterDiscard: () => void;
  onAfterSend: (ctx: { from: string }) => void;
  /** Escape navigates back / closes inline compose without discarding. */
  onEscape?: () => void;
  header?: ReactNode;
};

export function ComposeDraftEditor({
  draftId,
  initial,
  reply,
  forwardKey,
  threading,
  addresses,
  fromFallbacks,
  allowFromSelect = false,
  compact = false,
  autoFocusBody = false,
  autoFocusTo = false,
  skipAutosaveWhenEmpty = false,
  navigateOnSendStart = false,
  alwaysShowDiscard = false,
  onAfterDiscard,
  onAfterSend,
  onEscape,
  header,
}: ComposeDraftEditorProps) {
  const productId = useProductId();
  const { apiBase } = useEmailPaths();
  const { store } = useEmailMailbox();
  const generatedReplyId = useRef<string | null>(null);
  if (reply && !draftId && !generatedReplyId.current) {
    generatedReplyId.current = crypto.randomUUID();
  }
  const resolvedDraftId =
    draftId ?? (reply ? generatedReplyId.current : null);

  const mode = useMemo((): ComposeDraftMode => {
    if (reply) {
      return {
        kind: "reply",
        draftId: resolvedDraftId!,
        replyKey: reply.replyKey,
        replyAll: reply.replyAll,
        threading: reply.threading,
      };
    }
    return {
      kind: "standalone",
      draftId: resolvedDraftId,
      threading,
      forwardKey,
    };
  }, [forwardKey, reply, resolvedDraftId, threading]);

  const controller = useComposeDraftController({
    store,
    apiBase,
    productId,
    addresses,
    mode,
    initial,
    fromFallbacks,
    skipAutosaveWhenEmpty,
    navigateOnSendStart,
    onAfterDiscard,
    onAfterSend,
  });

  const form = (
    <ComposeForm
      sendFrom={controller.sendFrom}
      setSendFrom={controller.setSendFrom}
      addresses={addresses}
      sendTo={controller.sendTo}
      setSendTo={controller.setSendTo}
      sendCc={controller.sendCc}
      setSendCc={controller.setSendCc}
      sendSubject={controller.sendSubject}
      setSendSubject={controller.setSendSubject}
      sendText={controller.sendText}
      setSendText={controller.setSendText}
      attachments={controller.attachments}
      previewUrls={controller.previewUrls}
      attachmentError={controller.attachmentError}
      onAddFiles={controller.addFiles}
      onAddFromTransfer={controller.addFromTransfer}
      onRemoveAttachment={controller.removeAttachment}
      onRenameAttachment={controller.renameAttachment}
      sending={controller.sending}
      onSend={controller.send}
      draftStatus={controller.draftStatus}
      allowFromSelect={allowFromSelect}
      onDiscard={
        alwaysShowDiscard || controller.draftId || controller.hasContent
          ? controller.discard
          : undefined
      }
      onEscape={
        onEscape
          ? () => {
              controller.flushNow();
              onEscape();
            }
          : undefined
      }
      compact={compact}
      autoFocusBody={autoFocusBody}
      autoFocusTo={autoFocusTo}
    />
  );

  if (!header) return form;

  return (
    <div
      className={
        compact
          ? "mt-6 shrink-0 border-t border-border/30 pt-4"
          : "flex min-h-0 flex-1 flex-col"
      }
    >
      {header}
      {form}
    </div>
  );
}
