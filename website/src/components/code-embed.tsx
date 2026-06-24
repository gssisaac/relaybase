"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const tabs = [
  { id: "send", label: "Send" },
  { id: "receive", label: "Receive" },
  { id: "webhook", label: "Webhook" },
] as const;

type TabId = (typeof tabs)[number]["id"];

const codeExamples: Record<TabId, { lang: string; code: string }> = {
  send: {
    lang: "typescript",
    code: `// Send a billing email — one fetch call
const res = await fetch("https://api.relaybase.com/v1/send", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.RELAYBASE_API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    from: "billing@yourdomain.com",
    fromName: "Acme Billing",
    to: "customer@example.com",
    subject: "Invoice #1042",
    text: "Your invoice is ready.",
  }),
});

const { messageId } = await res.json();`,
  },
  receive: {
    lang: "typescript",
    code: `// Poll for new inbound mail (or use webhooks)
const res = await fetch(
  "https://api.relaybase.com/v1/inbox/events?limit=25",
  { headers: { Authorization: \`Bearer \${process.env.RELAYBASE_API_KEY}\` } },
);

const { events } = await res.json();

for (const event of events) {
  if (event.type === "inbound.email.received") {
    const msg = await fetch(
      \`https://api.relaybase.com/v1/inbox/messages/\${event.data.messageId}\`,
      { headers: { Authorization: \`Bearer \${process.env.RELAYBASE_API_KEY}\` } },
    );
    // Route to your ticket system, Slack, etc.
  }
}`,
  },
  webhook: {
    lang: "typescript",
    code: `// Register a webhook — push on every inbound email
await fetch("https://api.relaybase.com/v1/webhooks", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.RELAYBASE_API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    url: "https://myapp.com/hooks/relaybase",
  }),
});

// Verify signatures (Stripe-style HMAC)
import crypto from "crypto";

function verifySignature(secret: string, body: string, header: string) {
  const parts = Object.fromEntries(
    header.split(",").map((p) => p.trim().split("=") as [string, string]),
  );
  const expected = crypto
    .createHmac("sha256", secret)
    .update(\`\${parts.t}.\${body}\`)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(parts.v1),
    Buffer.from(expected),
  );
}`,
  },
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={handleCopy}
      className="text-slate-400 hover:text-white"
      aria-label="Copy code"
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
    </Button>
  );
}

export function CodeEmbed() {
  const [active, setActive] = useState<TabId>("send");
  const example = codeExamples[active];

  return (
    <section id="integrate" className="border-y border-border bg-slate-950 py-20 text-white">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <Badge
            variant="outline"
            className="mb-4 border-slate-700 bg-slate-900 text-slate-300"
          >
            Developer-first
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Embed send &amp; receive in minutes
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            No SDK required. Standard HTTP + JSON. Drop a fetch call into your
            backend, cron job, or serverless function and you&apos;re live.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-3xl">
          <div className="flex gap-1 rounded-lg bg-slate-900 p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActive(tab.id)}
                className={cn(
                  "flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors",
                  active === tab.id
                    ? "bg-slate-800 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="code-glow mt-3 overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="size-3 rounded-full bg-red-500/80" />
                <span className="size-3 rounded-full bg-amber-500/80" />
                <span className="size-3 rounded-full bg-emerald-500/80" />
              </div>
              <span className="font-mono text-xs text-slate-500">
                {example.lang}
              </span>
              <CopyButton text={example.code} />
            </div>
            <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-relaxed text-slate-300">
              <code>{example.code}</code>
            </pre>
          </div>

          <p className="mt-6 text-center text-sm text-slate-500">
            Two environment variables:{" "}
            <code className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-slate-300">
              RELAYBASE_API_KEY
            </code>{" "}
            and{" "}
            <code className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-slate-300">
              RELAYBASE_URL
            </code>
            . Works with Node, Deno, Cloudflare Workers, Vercel, and anything
            that can call fetch.
          </p>
        </div>
      </div>
    </section>
  );
}
