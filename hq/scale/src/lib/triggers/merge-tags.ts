import { readPayloadPath } from "./payload-path";

function stringifyTriggerValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

/** Replace `{{trigger.*}}` placeholders from the inbound event payload. */
export function applyTriggerMergeTags(text: string, payload: Record<string, unknown>): string {
  return text.replace(/\{\{trigger\.([a-zA-Z0-9_.-]+)\}\}/g, (_match, path: string) => {
    const value = readPayloadPath(payload, path) ?? readPayloadPath(payload, path.replace(/-/g, "_"));
    return stringifyTriggerValue(value);
  });
}

export function applyAutomationRecipientMergeTags(
  text: string,
  recipient: { email: string; name?: string | null },
): string {
  const displayName =
    recipient.name?.trim() ||
    recipient.email.split("@")[0] ||
    recipient.email;
  return text
    .replaceAll("{{contact.name}}", displayName)
    .replaceAll("{{contact.email}}", recipient.email);
}
