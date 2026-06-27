const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function splitRecipientInput(input: string): string[] {
  return input
    .split(/[,;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function parseEmailList(input: string): string[] {
  const seen = new Set<string>();
  const emails: string[] = [];
  for (const part of splitRecipientInput(input)) {
    const key = part.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    emails.push(part);
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
    if (!EMAIL_RE.test(part)) {
      invalid.push(part);
      continue;
    }
    const key = part.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    emails.push(part);
  }

  return { emails, invalid };
}

export function formatEmailList(emails: string[]): string {
  return emails.join(", ");
}
