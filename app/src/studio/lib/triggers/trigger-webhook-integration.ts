const TRIGGER_MERGE_PATH_RE = /\{\{trigger\.([a-zA-Z0-9_.-]+)\}\}/g;

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split(".").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return;
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (typeof current[part] !== "object" || current[part] === null) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]!] = value;
}

const SAMPLE_FIELD_VALUES: Record<string, string> = {
  verifyUrl: "https://yourdomain.com/verify?token=xyz123",
  signInUrl: "https://yourdomain.com/sign-in?token=xyz123",
  magicLinkUrl: "https://yourdomain.com/sign-in?token=xyz123",
  welcomeUrl: "https://yourdomain.com/welcome",
  resetUrl: "https://yourdomain.com/reset?token=xyz123",
  expiresInMinutes: "15",
  code: "849201",
  orderId: "ORD-2026-1042",
  amount: "49.00",
  invoiceNumber: "INV-2026-0042",
  invoiceUrl: "https://yourdomain.com/invoices/in_abc123",
  planName: "Pro (monthly)",
  message: "Sample message for preview.",
};

/** Parse `{{trigger.path.to.field}}` paths from template subject/body copy. */
export function extractTriggerMergePathsFromTexts(...texts: Array<string | null | undefined>): string[] {
  const paths = new Set<string>();
  for (const text of texts) {
    if (!text?.trim()) continue;
    for (const match of text.matchAll(TRIGGER_MERGE_PATH_RE)) {
      const path = match[1]?.trim();
      if (path) paths.add(path);
    }
  }
  return [...paths].sort((a, b) => a.localeCompare(b));
}

export function sampleValueForTriggerField(path: string): string {
  const leaf = path.split(".").pop() ?? path;
  if (SAMPLE_FIELD_VALUES[path]) return SAMPLE_FIELD_VALUES[path]!;
  if (SAMPLE_FIELD_VALUES[leaf]) return SAMPLE_FIELD_VALUES[leaf]!;
  const lower = leaf.toLowerCase();
  if (lower.includes("url") || lower.endsWith("link")) {
    return `https://yourdomain.com/${leaf.replace(/Url$/i, "").toLowerCase() || "action"}`;
  }
  if (lower.includes("email")) return "user@example.com";
  if (lower.includes("amount") || lower.includes("price")) return "49.00";
  if (lower.includes("date")) return "2026-09-16";
  return `[${path}]`;
}

/** Union of configured required fields and merge tags used in the email template. */
export function webhookTriggerFieldPaths(params: {
  requiredFields?: string[] | null;
  templateTexts: string[];
}): string[] {
  const paths = new Set<string>();
  for (const field of params.requiredFields ?? []) {
    const trimmed = field.trim();
    if (trimmed) paths.add(trimmed);
  }
  for (const path of extractTriggerMergePathsFromTexts(...params.templateTexts)) {
    paths.add(path);
  }
  return [...paths].sort((a, b) => a.localeCompare(b));
}

export function applyRecipientPathsToWebhookPayload(
  payload: Record<string, unknown>,
  params: { emailPath: string; namePath: string; email: string; name: string },
): Record<string, unknown> {
  const next = structuredClone(payload);
  setNestedValue(next, params.emailPath.trim() || "email", params.email);
  setNestedValue(next, params.namePath.trim() || "name", params.name);
  return next;
}

export function buildWebhookSamplePayload(params: {
  emailPath: string;
  namePath: string;
  triggerFieldPaths: string[];
}): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  const emailPath = params.emailPath.trim() || "email";
  const namePath = params.namePath.trim() || "name";
  setNestedValue(body, emailPath, "alex@example.com");
  setNestedValue(body, namePath, "Alex Kim");
  for (const path of params.triggerFieldPaths) {
    if (!path.trim()) continue;
    if (path === emailPath || path === namePath) continue;
    setNestedValue(body, path, sampleValueForTriggerField(path));
  }
  return body;
}

export function buildWebhookIntegrationAiInstructions(params: {
  triggerName: string;
  triggerId: string;
  url: string;
  secretPlaceholder: string;
  emailPath: string;
  namePath: string;
  triggerFieldPaths: string[];
  samplePayload: Record<string, unknown>;
  curlSnippet: string;
}): string {
  const emailPath = params.emailPath.trim() || "email";
  const namePath = params.namePath.trim() || "name";
  const jsonBody = JSON.stringify(params.samplePayload, null, 2);
  const fieldLines =
    params.triggerFieldPaths.length > 0
      ? params.triggerFieldPaths
          .map((path) => `- \`${path}\` → merge tag \`{{trigger.${path}}}\` in the email template`)
          .join("\n")
      : "- (No `{{trigger.*}}` fields in the template — only recipient paths are required.)";

  return `# Relaybase HTTP webhook integration

Implement a server-side call that sends one transactional email when an event happens in our app.

## Trigger
- Name: ${params.triggerName}
- ID: ${params.triggerId}

## HTTP request
- Method: POST
- URL: ${params.url}
- Headers:
  - \`Authorization: Bearer ${params.secretPlaceholder}\`
  - \`Content-Type: application/json\`
  - \`Idempotency-Key\` (optional but recommended — unique per logical event; prevents duplicate sends on retries)

## Recipient (required)
- \`${emailPath}\` — recipient email (string)
- \`${namePath}\` — recipient display name (string, recommended)

## Payload fields for email merge tags
Each key below must appear in the JSON body at the given dot path (nested objects allowed):

${fieldLines}

Values are substituted into the template as \`{{trigger.<path>}}\`. Missing required fields or an invalid email returns HTTP 202 with \`skipReason: "invalid_payload"\`.

## Example JSON body
\`\`\`json
${jsonBody}
\`\`\`

## Example curl
\`\`\`bash
${params.curlSnippet}
\`\`\`

## Task
Wire our existing event handler (e.g. billing, auth, CRM webhook) to map its data into this JSON shape and POST to Relaybase when the event occurs. Use environment variables for the Bearer secret; never expose the secret to the browser.
`;
}
