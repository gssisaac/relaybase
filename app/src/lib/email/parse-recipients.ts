import { splitRecipients } from "@/lib/email/format-sender";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function splitRecipientInput(input: string): string[] {
  return input
    .split(/[,;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export type ParsedRecipientToken = {
  raw: string;
  email?: string;
  displayName?: string;
};

/** Split stored To/Cc value into individual chip tokens. */
export function tokenizeRecipientValue(value: string): string[] {
  return splitRecipients(value).map((entry) => entry.raw);
}

/** Parse a single typed or pasted recipient token. */
export function parseRecipientToken(raw: string): ParsedRecipientToken {
  const trimmed = raw.trim();
  if (!trimmed) return { raw: trimmed };
  const [entry] = splitRecipients(trimmed);
  if (!entry) return { raw: trimmed };
  return {
    raw: entry.raw,
    email: entry.email,
    displayName: entry.name,
  };
}

export function isValidRecipientToken(raw: string): boolean {
  const { email } = parseRecipientToken(raw);
  return Boolean(email && EMAIL_RE.test(email));
}

export function recipientTokenEmail(raw: string): string | undefined {
  const { email } = parseRecipientToken(raw);
  return email && EMAIL_RE.test(email) ? email : undefined;
}

/** Split pasted/typed multi-recipient text into tokens. */
export function tokenizeRecipientInput(input: string): string[] {
  return splitRecipientInput(input);
}

export function formatRecipientTokens(tokens: string[]): string {
  return tokens.join(", ");
}

export function parseEmailList(input: string): string[] {
  const seen = new Set<string>();
  const emails: string[] = [];
  for (const part of splitRecipientInput(input)) {
    const email = recipientTokenEmail(part) ?? part;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    emails.push(email);
  }
  return emails;
}

export function parseEmailListStrict(input: string): {
  emails: string[];
  invalid: string[];
} {
  const emails: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  for (const part of splitRecipientInput(input)) {
    const email = recipientTokenEmail(part);
    if (!email) {
      invalid.push(part);
      continue;
    }
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    emails.push(email);
  }

  return { emails, invalid };
}

export function formatEmailList(emails: string[]): string {
  return emails.join(", ");
}
