import type { SentEmail } from "@/email/components/mailbox/types";

export const EMAIL_SEND_STARTED = "relaybase:email-send-started";
export const EMAIL_SEND_SUCCEEDED = "relaybase:email-send-succeeded";
export const EMAIL_SEND_FAILED = "relaybase:email-send-failed";
export const EMAIL_SEND_UNDONE = "relaybase:email-send-undone";

export type EmailSendStartedDetail = {
  pendingId: string;
  placeholder: SentEmail;
};

export type EmailSendSucceededDetail = {
  pendingId: string;
  sent?: SentEmail;
};

export type EmailSendFailedDetail = {
  pendingId: string;
  error: string;
  code?: string;
};

export type EmailSendUndoneDetail = {
  draftId: string;
  from: string;
  replyKey?: string;
  replyAll?: boolean;
  /** Only set for a true manual Unsend — absent when a failed send auto-restores the draft. */
  pendingId?: string;
};

export function dispatchEmailSendStarted(detail: EmailSendStartedDetail) {
  window.dispatchEvent(
    new CustomEvent<EmailSendStartedDetail>(EMAIL_SEND_STARTED, { detail }),
  );
}

export function dispatchEmailSendSucceeded(detail: EmailSendSucceededDetail) {
  window.dispatchEvent(
    new CustomEvent<EmailSendSucceededDetail>(EMAIL_SEND_SUCCEEDED, {
      detail,
    }),
  );
}

export function dispatchEmailSendFailed(detail: EmailSendFailedDetail) {
  window.dispatchEvent(
    new CustomEvent<EmailSendFailedDetail>(EMAIL_SEND_FAILED, {
      detail,
    }),
  );
}

export function dispatchEmailSendUndone(detail: EmailSendUndoneDetail) {
  window.dispatchEvent(
    new CustomEvent<EmailSendUndoneDetail>(EMAIL_SEND_UNDONE, {
      detail,
    }),
  );
}
