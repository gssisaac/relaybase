"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import type { ThreadComposeMode } from "@/email/components/ConversationThreadView";
import {
  EMAIL_SEND_UNDONE,
  type EmailSendUndoneDetail,
} from "@/email/components/email-send-events";
import { useEmailMailboxStore } from "@/email/components/EmailMailboxContext";
import {
  resolveReplyOpenDraftId,
  useThreadComposeOpener,
} from "@/email/compose-open";

/**
 * Inline thread compose state (reply/forward panel on an open conversation).
 * URL-based standalone compose uses `@/email/compose-open` openers instead.
 */
export function useThreadComposeState({
  folder,
  messageId,
  threadId,
  inbox,
}: {
  folder: "inbox" | "drafts" | "sent" | "trash";
  messageId?: string;
  /** Conversation thread id when an inbox thread is selected. */
  threadId?: string | null;
  inbox: string;
}) {
  const store = useEmailMailboxStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { resumeOrNewDraftId } = useThreadComposeOpener();

  const [composeMode, setComposeMode] = useState<ThreadComposeMode>(null);
  const [composeSourceId, setComposeSourceId] = useState<string | null>(null);
  const [composeDraftId, setComposeDraftId] = useState<string | null>(null);
  /** After Discard, do not auto-reopen a reply when revisiting this thread. */
  const composeDismissedThreadRef = useRef<string | null>(null);

  const closeCompose = useCallback(() => {
    const key = threadId ?? messageId;
    if (key) composeDismissedThreadRef.current = key;
    setComposeSourceId(null);
    setComposeDraftId(null);
    setComposeMode(null);
  }, [messageId, threadId]);

  const openCompose = useCallback(
    (
      mode: Exclude<ThreadComposeMode, null>,
      sourceId?: string | null,
      /** Omit to start a new draft; pass an id to reopen a specific draft. */
      draftId?: string | null,
    ) => {
      composeDismissedThreadRef.current = null;
      setComposeSourceId(sourceId ?? null);
      setComposeDraftId(draftId ?? crypto.randomUUID());
      setComposeMode(mode);
    },
    [],
  );

  /** Keyboard r/a/f: resume matching draft at default target, else new. */
  const openComposeFromKeyboard = useCallback(
    (mode: Exclude<ThreadComposeMode, null>, inboundKey: string) => {
      openCompose(
        mode,
        `inbound:${inboundKey}`,
        resumeOrNewDraftId(mode, inboundKey),
      );
    },
    [openCompose, resumeOrNewDraftId],
  );

  // Unsend restores the draft then navigates with ?reply=1 — also reopen here so
  // same-route searchParam updates always restore the reply editor (not just body).
  useEffect(() => {
    const onUndone = (event: Event) => {
      const detail = (event as CustomEvent<EmailSendUndoneDetail>).detail;
      if (!detail?.replyKey) return;
      if (folder !== "inbox") return;
      openCompose(
        detail.replyAll ? "replyAll" : "reply",
        `inbound:${detail.replyKey}`,
        detail.draftId,
      );
    };
    window.addEventListener(EMAIL_SEND_UNDONE, onUndone);
    return () => window.removeEventListener(EMAIL_SEND_UNDONE, onUndone);
  }, [folder, openCompose]);

  const wantsReplyParam = searchParams.get("reply");
  const wantsReplyAllParam = searchParams.get("replyAll");
  const wantsDraftIdParam = searchParams.get("draftId");

  // When opening a message: restore reply panel from ?reply= / ?draftId= query
  useEffect(() => {
    if (folder !== "inbox" || !messageId) {
      setComposeSourceId(null);
      setComposeDraftId(null);
      setComposeMode(null);
      return;
    }
    const dismissKey = threadId ?? messageId;
    const wantsReply = wantsReplyParam === "1";
    const wantsReplyAll = wantsReplyAllParam === "1";
    if (wantsReply || wantsReplyAll) {
      const mode = wantsReplyAll ? "replyAll" : "reply";
      const draftId = resolveReplyOpenDraftId(
        store,
        mode,
        messageId,
        wantsDraftIdParam,
      );
      composeDismissedThreadRef.current = null;
      setComposeSourceId(`inbound:${messageId}`);
      setComposeDraftId(draftId);
      setComposeMode(mode);
      const params = new URLSearchParams(searchParams.toString());
      params.delete("reply");
      params.delete("replyAll");
      params.delete("draftId");
      params.set("m", messageId);
      router.replace(`${inbox}?${params.toString()}`);
      return;
    }
    // Draft reply/forward rows render in ConversationThreadView — do not
    // auto-open the composer when a thread merely has saved drafts.
    if (composeDismissedThreadRef.current === dismissKey) {
      setComposeSourceId(null);
      setComposeDraftId(null);
      setComposeMode(null);
      return;
    }
    setComposeSourceId(null);
    setComposeDraftId(null);
    setComposeMode(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    folder,
    messageId,
    threadId,
    wantsReplyParam,
    wantsReplyAllParam,
    wantsDraftIdParam,
    store,
  ]);

  const onComposeModeChange = useCallback(
    (mode: ThreadComposeMode) => {
      if (mode === null) {
        closeCompose();
        return;
      }
      composeDismissedThreadRef.current = null;
      setComposeMode(mode);
    },
    [closeCompose],
  );

  return {
    composeMode,
    composeSourceId,
    setComposeSourceId,
    composeDraftId,
    setComposeDraftId,
    closeCompose,
    openCompose,
    openComposeFromKeyboard,
    onComposeModeChange,
  };
}
