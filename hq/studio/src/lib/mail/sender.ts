import { resolveWorkerSendCredentials } from "@lib/mail/credentials";
import { htmlToPlainText } from "@lib/mail/html-to-text";

/**
 * Delivery goes through the customer Worker `POST /v1/send` (studio-mode-v0.2.md §1.2).
 * Set `STUDIO_SEND_STUB=1` to log-only (no network) for local UI tests.
 */
export type SendMailInput = {
  to: string;
  from: string;
  fromName?: string | null;
  replyTo?: string | null;
  subject: string;
  html: string;
  /** RFC 8058 List-Unsubscribe target (HTTPS). Worker header forwarding TBD. */
  listUnsubscribeUrl?: string;
};

export type SendMailResult =
  | { ok: true; messageId?: string }
  | { ok: false; error: string };

function useSendStub(): boolean {
  return process.env.STUDIO_SEND_STUB === "1" || process.env.STUDIO_SEND_STUB === "true";
}

export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const to = input.to.trim();
  const from = input.from.trim();
  const subject = input.subject.trim();

  if (!to.includes("@")) {
    return { ok: false, error: "invalid recipient address" };
  }
  if (!from.includes("@")) {
    return { ok: false, error: "invalid from address" };
  }
  if (!subject) {
    return { ok: false, error: "subject is required" };
  }

  const extraHeaders: Record<string, string> = {};
  if (input.listUnsubscribeUrl) {
    extraHeaders["List-Unsubscribe"] = `<${input.listUnsubscribeUrl}>`;
    extraHeaders["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  if (useSendStub()) {
    console.log(
      `[studio-mail-sender:stub] would POST /v1/send → from=${from} to=${to} subject=${JSON.stringify(subject)} (html ${input.html.length} bytes) headers=${JSON.stringify(extraHeaders)}`,
    );
    return { ok: true, messageId: "stub" };
  }

  const auth = resolveWorkerSendCredentials();
  if (!auth.ok) {
    return { ok: false, error: auth.error };
  }

  const text = htmlToPlainText(input.html);
  const url = `${auth.workerUrl}/v1/send`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        fromName: input.fromName?.trim() || undefined,
        to,
        subject,
        text,
        html: input.html,
        replyTo: input.replyTo?.trim() || undefined,
      }),
    });
  } catch (err) {
    const hint = err instanceof TypeError ? ` — cannot reach ${auth.workerUrl}` : "";
    return { ok: false, error: `Worker send failed${hint}` };
  }

  const data = (await res.json().catch(() => ({}))) as {
    messageId?: string;
    error?: string;
  };

  if (!res.ok) {
    return {
      ok: false,
      error: data.error ?? `Worker rejected send (HTTP ${res.status})`,
    };
  }

  return { ok: true, messageId: data.messageId ?? "sent" };
}
