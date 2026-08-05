export const EMAIL_SEND_STARTED = "relaybase:email-send-started";
export const EMAIL_SEND_SUCCEEDED = "relaybase:email-send-succeeded";
export const EMAIL_SEND_FAILED = "relaybase:email-send-failed";

export type EmailSendFailedDetail = {
  error: string;
};

export function dispatchEmailSendStarted() {
  window.dispatchEvent(new CustomEvent(EMAIL_SEND_STARTED));
}

export function dispatchEmailSendSucceeded() {
  window.dispatchEvent(new CustomEvent(EMAIL_SEND_SUCCEEDED));
}

export function dispatchEmailSendFailed(error: string) {
  window.dispatchEvent(
    new CustomEvent<EmailSendFailedDetail>(EMAIL_SEND_FAILED, {
      detail: { error },
    }),
  );
}
