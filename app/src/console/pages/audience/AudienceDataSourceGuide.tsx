"use client";

import { Check, Copy } from "lucide-react";
import { useState, type ReactNode } from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";

const EXAMPLE_JSON = `[
  { "email": "alice@example.com", "name": "Alice" },
  { "email": "bob@example.com", "name": "Bob" }
]`;

const EXAMPLE_WRAPPED = `{
  "contacts": [
    { "email": "alice@example.com", "name": "Alice" },
    { "email": "bob@example.com" }
  ]
}`;

const EXAMPLE_CURL = `curl -sS -H "Authorization: Bearer YOUR_TOKEN" \\
  https://your-api.example.com/audience`;

/** Full markdown guide — also what "Copy guide" puts on the clipboard. */
export const AUDIENCE_DATA_SOURCE_GUIDE_MARKDOWN = `# Relaybase audience data source API

Build an HTTPS endpoint that returns your contact list as JSON.
Relaybase calls this URL on **Test connection**, **Refresh now**, and scheduled sync.

---

## 1. Request (what Relaybase sends)

| Item | Value |
|------|--------|
| Method | \`GET\` |
| URL | The Endpoint URL you configure |
| Accept | JSON (\`res.json()\`) |

### Authentication

If you set an **API key / token** in Relaybase:

- Default header: \`Authorization: Bearer <token>\`
- Equivalent curl:

\`\`\`bash
${EXAMPLE_CURL}
\`\`\`

- Put the secret in the **API key / token** field (not in Header name).
- Leave **Header name** empty (or \`Authorization\`) unless your API needs a custom header (e.g. \`X-API-Key\`).
- For a custom header, Relaybase sends the raw token as the header value (no \`Bearer \` prefix).

If no token is set, Relaybase sends **no** auth header.

### What your API should expect

- Server-to-server GET (from Cloudflare Workers / Relaybase), not a browser.
- No request body.
- No required query params (unless your own URL includes them).
- Respond quickly; large lists are fine as one JSON response.

---

## 2. Response (what Relaybase expects)

### HTTP status

| Status | Meaning |
|--------|---------|
| \`200\` | Success — body is parsed for contacts |
| Other (\`401\`, \`403\`, \`404\`, \`500\`, …) | Fail — sync/test shows an error |

Use \`401\` when the token is missing/invalid so Test connection fails clearly.

### Content type

- Body must be valid JSON.
- Prefer \`Content-Type: application/json\`.

### Body shape (recommended)

A **JSON array** of contact objects:

\`\`\`json
${EXAMPLE_JSON}
\`\`\`

### Body shape (also accepted)

An object whose array is under one of these keys: \`contacts\`, \`data\`, \`items\`, \`results\`:

\`\`\`json
${EXAMPLE_WRAPPED}
\`\`\`

If the body is neither a root array nor one of those wrappers, sync fails with a format error.

---

## 3. Contact object fields

| Field | Required | Rules |
|-------|----------|--------|
| \`email\` | **Yes** | Non-empty string, must contain \`@\`. Stored lowercased. |
| \`name\` | No | String; trimmed. If missing, Relaybase uses the email local-part (before \`@\`) as the display name. |

### Ignored / skipped rows

These are counted as **skipped** (not imported):

- Non-object array entries (strings, numbers, \`null\`)
- Objects without a valid \`email\`
- Extra fields (\`id\`, \`phone\`, …) are ignored — safe to include

Duplicate emails across syncs: last sync wins for that group’s synced contacts (manual contacts are separate).

---

## 4. Minimal Worker / API example

Return a root array:

\`\`\`js
export default {
  async fetch(request, env) {
    const auth = request.headers.get("Authorization") || "";
    if (auth !== \`Bearer \${env.AUDIENCE_TOKEN}\`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contacts = [
      { email: "alice@example.com", name: "Alice" },
      { email: "bob@example.com", name: "Bob" },
    ];

    return Response.json(contacts, {
      headers: { "Content-Type": "application/json" },
    });
  },
};
\`\`\`

---

## 5. Checklist before Test connection

1. URL is HTTPS and publicly reachable.
2. \`curl\` with the same \`Authorization: Bearer …\` returns \`200\` + JSON array.
3. Token is in Relaybase **API key / token** (Header name blank or \`Authorization\`).
4. At least one object has a valid \`email\`.
5. Click **Test connection** — you should see a contact count (and sample emails when creating a group).

---

## 6. Sync behavior (for API designers)

- Relaybase **GETs** your URL and replaces the group’s **synced** contacts with the parsed list.
- Manual contacts in the same group are not removed by sync.
- Scheduled refresh uses the same request/response rules as Test connection.
`;

function GuideSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="font-medium text-foreground">{title}</p>
      {children}
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-md border border-border/60 bg-background/80 p-2.5 font-mono text-[11px] leading-relaxed text-foreground whitespace-pre">
      {children}
    </pre>
  );
}

export function AudienceDataSourceGuide() {
  const [copiedGuide, setCopiedGuide] = useState(false);
  const [copiedExample, setCopiedExample] = useState(false);

  async function copyGuide() {
    await navigator.clipboard.writeText(AUDIENCE_DATA_SOURCE_GUIDE_MARKDOWN);
    setCopiedGuide(true);
    window.setTimeout(() => setCopiedGuide(false), 2000);
  }

  async function copyExample() {
    await navigator.clipboard.writeText(EXAMPLE_JSON);
    setCopiedExample(true);
    window.setTimeout(() => setCopiedExample(false), 1500);
  }

  return (
    <Accordion>
      <AccordionItem value="endpoint-guide" className="border-0">
        <AccordionTrigger className="justify-start gap-1 py-1 text-xs font-normal text-primary hover:underline **:data-[slot=accordion-trigger-icon]:ml-1 **:data-[slot=accordion-trigger-icon]:size-3 **:data-[slot=accordion-trigger-icon]:text-primary">
          View endpoint API guide
        </AccordionTrigger>
        <AccordionContent className="mt-1.5 rounded-lg border border-border/60 bg-muted/20 px-3 pt-3 pb-3 text-xs text-muted-foreground [&_p:not(:last-child)]:mb-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3">
            <p className="text-[11px] text-muted-foreground">
              Full spec for building a compatible audience API.
            </p>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => void copyGuide()}
            >
              {copiedGuide ? (
                <Check className="size-3" />
              ) : (
                <Copy className="size-3" />
              )}
              {copiedGuide ? "Guide copied" : "Copy entire guide"}
            </Button>
          </div>

          <div className="max-h-[min(28rem,60vh)] space-y-4 overflow-y-auto pr-1">
            <GuideSection title="1. Request (what Relaybase sends)">
              <ul className="list-disc space-y-1 pl-4">
                <li>
                  Method: <span className="font-mono text-foreground">GET</span>
                </li>
                <li>URL: your configured Endpoint URL</li>
                <li>No body, no required query params</li>
                <li>
                  If a token is set →{" "}
                  <span className="font-mono text-foreground">
                    Authorization: Bearer &lt;token&gt;
                  </span>
                </li>
                <li>
                  Put the secret in <span className="text-foreground">API key / token</span>
                  ; leave Header name empty (or{" "}
                  <span className="font-mono text-foreground">Authorization</span>
                  )
                </li>
              </ul>
              <CodeBlock>{EXAMPLE_CURL}</CodeBlock>
            </GuideSection>

            <GuideSection title="2. Response status">
              <ul className="list-disc space-y-1 pl-4">
                <li>
                  <span className="font-mono text-foreground">200</span> + valid
                  JSON → contacts imported
                </li>
                <li>
                  <span className="font-mono text-foreground">401</span> /{" "}
                  <span className="font-mono text-foreground">403</span> → auth
                  failed (check token field)
                </li>
                <li>Any non-200 → test/sync fails with that status</li>
              </ul>
            </GuideSection>

            <GuideSection title="3. Response body (recommended)">
              <p>
                Root JSON <span className="text-foreground">array</span> of
                objects. Each object needs{" "}
                <span className="font-mono text-foreground">email</span>{" "}
                (required) and optional{" "}
                <span className="font-mono text-foreground">name</span>.
              </p>
              <div className="flex items-center justify-between gap-2 pt-1">
                <p className="font-medium text-foreground">Example</p>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => void copyExample()}
                >
                  {copiedExample ? (
                    <Check className="size-3" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                  {copiedExample ? "Copied" : "Copy example"}
                </Button>
              </div>
              <CodeBlock>{EXAMPLE_JSON}</CodeBlock>
              <p className="pt-1">
                Also accepted: wrap the array under{" "}
                <span className="font-mono text-foreground">contacts</span>,{" "}
                <span className="font-mono text-foreground">data</span>,{" "}
                <span className="font-mono text-foreground">items</span>, or{" "}
                <span className="font-mono text-foreground">results</span>.
              </p>
            </GuideSection>

            <GuideSection title="4. Field rules">
              <ul className="list-disc space-y-1 pl-4">
                <li>
                  <span className="font-mono text-foreground">email</span> —
                  string with <span className="font-mono">@</span>; stored
                  lowercase
                </li>
                <li>
                  <span className="font-mono text-foreground">name</span> —
                  optional; if omitted, uses the part before{" "}
                  <span className="font-mono">@</span>
                </li>
                <li>
                  Invalid / missing email rows are <span className="text-foreground">skipped</span>
                  , not fatal
                </li>
                <li>Extra fields are ignored</li>
              </ul>
            </GuideSection>

            <GuideSection title="5. Checklist">
              <ul className="list-disc space-y-1 pl-4">
                <li>HTTPS URL reachable from the public internet</li>
                <li>
                  Same curl as above returns{" "}
                  <span className="font-mono text-foreground">200</span> + array
                </li>
                <li>Token in API key / token field</li>
                <li>At least one valid email in the array</li>
                <li>Use Test connection before saving</li>
              </ul>
            </GuideSection>

            <GuideSection title="6. Sync notes">
              <ul className="list-disc space-y-1 pl-4">
                <li>
                  Refresh / cron uses the same GET + parse rules as Test
                </li>
                <li>Synced contacts are replaced by the latest response</li>
                <li>Manual contacts in the group are kept</li>
              </ul>
            </GuideSection>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
