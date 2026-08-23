import type { WorkerEnv } from "./types";

const FROM = "beta@relaybase.xyz";
const FROM_NAME = "Relaybase Beta";

export async function sendBetaInviteEmail(
  env: WorkerEnv,
  to: string,
  downloadUrl: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const workerUrl = env.RELAYBASE_WORKER_URL?.replace(/\/$/, "");
  const token = env.RELAYBASE_ADMIN_TOKEN;
  if (!workerUrl || !token) {
    return { ok: false, error: "Email sending is not configured" };
  }

  const text = [
    "Thanks for joining the Relaybase beta.",
    "",
    "Download the Mac app with your personal link:",
    downloadUrl,
    "",
    "This link is unique to you. Keep it private.",
    "",
    "— Relaybase",
  ].join("\n");

  const html = `
    <p>Thanks for joining the Relaybase beta.</p>
    <p><a href="${escapeHtml(downloadUrl)}">Download the Mac app</a></p>
    <p>Or paste this link into your browser:</p>
    <p><a href="${escapeHtml(downloadUrl)}">${escapeHtml(downloadUrl)}</a></p>
    <p>This link is unique to you. Keep it private.</p>
    <p>— Relaybase</p>
  `.trim();

  try {
    const res = await fetch(`${workerUrl}/mail/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        fromName: FROM_NAME,
        to,
        subject: "Your Relaybase beta download",
        text,
        html,
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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
