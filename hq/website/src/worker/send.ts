import { formatEmail, type FormattedEmail } from "../lib/email-format";
import type { WorkerEnv } from "./types";

type SendResult = { ok: true } | { ok: false; error: string };

export async function sendBetaSignupEmails(
  env: WorkerEnv,
  to: string,
  downloadUrl: string,
  options: { includeGreeting: boolean },
): Promise<SendResult> {
  const workerUrl = env.RELAYBASE_WORKER_URL?.replace(/\/$/, "");
  const apiKey = env.RELAYBASE_API_KEY;
  if (!workerUrl || !apiKey) {
    return { ok: false, error: "Email sending is not configured" };
  }

  if (options.includeGreeting) {
    const greeting = await sendViaApi(
      workerUrl,
      apiKey,
      to,
      formatEmail({ kind: "beta-welcome" }),
    );
    if (!greeting.ok) return greeting;
  }

  return sendViaApi(
    workerUrl,
    apiKey,
    to,
    formatEmail({ kind: "beta-download", downloadUrl }),
  );
}

async function sendViaApi(
  workerUrl: string,
  apiKey: string,
  to: string,
  mail: FormattedEmail,
): Promise<SendResult> {
  try {
    const res = await fetch(`${workerUrl}/v1/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: mail.from,
        fromName: mail.fromName,
        to,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return {
        ok: false,
        error: body.error ?? `Relaybase send failed (${res.status})`,
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not reach Relaybase to send email" };
  }
}
