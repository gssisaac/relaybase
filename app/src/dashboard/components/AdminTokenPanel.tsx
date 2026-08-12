"use client";

import { Check, Copy, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WORKER_INSTALL_ZIP_URL } from "@/lib/desktop/bridge";

function generateAdminToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `rb_admin_${hex}`;
}

function maskToken(token: string): string {
  if (token.length <= 12) return "••••••••••••";
  return `${token.slice(0, 10)}${"•".repeat(18)}${token.slice(-4)}`;
}

/**
 * Build the full one-shot manual install script: download + unzip + npm install
 * + wrangler KV/R2/secret/deploy. The admin token is embedded so the user
 * copies one block and runs it in a terminal.
 */
function fullInstallCommand(token: string, zipUrl: string): string {
  const escaped = token.replace(/'/g, `'\\''`);
  return [
    `curl -L -o relaybase-worker-install.zip '${zipUrl}'`,
    `unzip -o relaybase-worker-install.zip -d relaybase-worker-install`,
    `cd relaybase-worker-install`,
    `npm install`,
    `npx wrangler kv namespace create relaybase-app`,
    `npx wrangler r2 bucket create relaybase-inbound`,
    `printf '%s' '${escaped}' | npx wrangler secret put ADMIN_TOKEN`,
    `npx wrangler deploy`,
  ].join("\n");
}

async function copyText(value: string): Promise<void> {
  await navigator.clipboard.writeText(value);
}

export function AdminTokenPanel({
  value,
  onChange,
}: {
  value: string;
  onChange: (token: string) => void;
}) {
  const [copied, setCopied] = useState<"cmd" | "token" | null>(null);

  // Do NOT auto-generate on mount — that silently replaces a token the user
  // already deployed, causing Verify to send the wrong secret.

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(null), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);

  function rotate() {
    onChange(generateAdminToken());
    setCopied(null);
  }

  async function copyCommand() {
    if (!value) return;
    await copyText(fullInstallCommand(value, WORKER_INSTALL_ZIP_URL));
    setCopied("cmd");
  }

  async function copyTokenOnly() {
    if (!value) return;
    await copyText(value);
    setCopied("token");
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div>
        <p className="text-sm font-medium">Admin token</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Not a Cloudflare API token. Generate one here (or paste a token you
          already set on the Worker). Copy the full command below, run it in a
          terminal, then come back and verify with the same token.
        </p>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="admin-token-input">Admin token</Label>
          <span className="font-mono text-[11px] text-muted-foreground">
            {value ? maskToken(value) : "—"}
          </span>
        </div>
        <Input
          id="admin-token-input"
          type="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Paste existing token or use Generate / Rotate"
          className="font-mono text-xs"
          autoComplete="off"
          spellCheck={false}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!value}
            onClick={() => void copyTokenOnly()}
          >
            {copied === "token" ? (
              <Check className="size-3.5" />
            ) : (
              <Copy className="size-3.5" />
            )}
            {copied === "token" ? "Copied" : "Copy token"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={rotate}>
            <RefreshCw className="size-3.5" />
            {value.trim() ? "Rotate" : "Generate"}
          </Button>
        </div>
      </div>

      <div className="space-y-2 rounded-md border border-border/80 bg-muted/30 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-foreground">
            Full install command
          </p>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            aria-label="Copy full install command"
            disabled={!value}
            onClick={() => void copyCommand()}
          >
            {copied === "cmd" ? (
              <Check className="size-3.5" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </Button>
        </div>
        <pre className="overflow-x-auto rounded bg-black/80 p-3 font-mono text-[11px] leading-relaxed text-emerald-300">
          {value
            ? fullInstallCommand(value, WORKER_INSTALL_ZIP_URL)
            : "Generate a token to reveal the full command."}
        </pre>
        <p className="text-[11px] text-muted-foreground">
          Run this in a terminal. After <span className="font-mono">wrangler deploy</span>{" "}
          prints your <span className="font-mono">*.workers.dev</span> URL, come
          back and tap &ldquo;I&apos;m done&rdquo;. Rotating the token means you
          must run the new command again before verifying.
        </p>
      </div>
    </div>
  );
}
