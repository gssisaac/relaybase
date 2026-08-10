"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  EMAIL_SEND_UNDONE,
  type EmailSendUndoneDetail,
} from "@/email/components/email-send-events";
import { emailMessageHref, useEmailPaths } from "@/email/paths";

/** Reopens the draft or reply composer after Unsend / failed delayed send. */
export function EmailSendUndoneNavigator() {
  const router = useRouter();
  const { inbox, drafts } = useEmailPaths();

  useEffect(() => {
    const onUndone = (event: Event) => {
      const detail = (event as CustomEvent<EmailSendUndoneDetail>).detail;
      if (!detail?.draftId) return;

      if (detail.replyKey) {
        router.push(
          emailMessageHref(inbox, detail.replyKey, {
            account: detail.from,
            params: {
              replyAll: detail.replyAll ? "1" : undefined,
              reply: detail.replyAll ? undefined : "1",
              draftId: detail.draftId,
            },
          }),
        );
        return;
      }

      router.push(emailMessageHref(drafts, detail.draftId));
    };

    window.addEventListener(EMAIL_SEND_UNDONE, onUndone);
    return () => window.removeEventListener(EMAIL_SEND_UNDONE, onUndone);
  }, [drafts, inbox, router]);

  return null;
}
