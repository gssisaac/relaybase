"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  EMAIL_SEND_UNDONE,
  type EmailSendUndoneDetail,
} from "@/email/components/email-send-events";
import { useEmailPaths } from "@/email/paths";

/** Reopens the draft or reply composer after Unsend / failed delayed send. */
export function EmailSendUndoneNavigator() {
  const router = useRouter();
  const { inbox, drafts } = useEmailPaths();

  useEffect(() => {
    const onUndone = (event: Event) => {
      const detail = (event as CustomEvent<EmailSendUndoneDetail>).detail;
      if (!detail?.draftId) return;

      if (detail.replyKey) {
        const params = new URLSearchParams();
        if (detail.replyAll) params.set("replyAll", "1");
        else params.set("reply", "1");
        if (detail.from) params.set("account", detail.from);
        router.push(
          `${inbox}/${encodeURIComponent(detail.replyKey)}?${params.toString()}`,
        );
        return;
      }

      router.push(`${drafts}/${encodeURIComponent(detail.draftId)}`);
    };

    window.addEventListener(EMAIL_SEND_UNDONE, onUndone);
    return () => window.removeEventListener(EMAIL_SEND_UNDONE, onUndone);
  }, [drafts, inbox, router]);

  return null;
}
