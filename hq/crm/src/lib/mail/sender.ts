/**
 * Real delivery always goes through the customer Worker's domain-scoped
 * `/v1/send` (crm-mode-v0.2.md §1.2) — hq/crm never sends mail itself. No
 * customer Worker is reachable in this dev environment, so this is a stub
 * that logs instead of calling out. Swap the body for a real
 * `fetch(`${workerUrl}/v1/send`, { headers: { Authorization: `Bearer ${apiKey}` }, ... })`
 * once `accounts_link.apiKeyEncrypted` is wired up.
 */
export type SendMailInput = {
  to: string;
  from?: string;
  subject: string;
  html: string;
  /** RFC 8058 List-Unsubscribe target (HTTPS). */
  listUnsubscribeUrl?: string;
};

export type SendMailResult = { ok: true } | { ok: false; error: string };

export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  if (!input.to.includes("@")) {
    return { ok: false, error: "invalid recipient address" };
  }
  const headers: Record<string, string> = {};
  if (input.listUnsubscribeUrl) {
    headers["List-Unsubscribe"] = `<${input.listUnsubscribeUrl}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }
  console.log(
    `[dev-mail-sender] would POST /v1/send → to=${input.to} subject=${JSON.stringify(input.subject)} (html ${input.html.length} bytes) headers=${JSON.stringify(headers)}`,
  );
  return { ok: true };
}
