"use client";

import { Check, Copy, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

function wranglerSecretCommand(token: string): string {
  // Pipe so the user does not re-type the secret interactively.
  const escaped = token.replace(/'/g, `'\\''`);
  return `printf '%s' '${escaped}' | npx wrangler secret put ADMIN_TOKEN`;
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
    await copyText(wranglerSecretCommand(value));
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
          already set on the Worker). Copy the wrangler command to store it,
          then Verify with the same value.
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
        <p className="text-xs font-medium text-foreground">
          Set secret on the Worker
        </p>
        <p className="font-mono text-[11px] leading-relaxed text-muted-foreground break-all">
          printf &apos;%s&apos; &apos;
          <span className="text-foreground/80">•••</span>
          &apos; | npx wrangler secret put ADMIN_TOKEN
        </p>
        <Button
          type="button"
          size="sm"
          className="w-full sm:w-auto"
          disabled={!value}
          onClick={() => void copyCommand()}
        >
          {copied === "cmd" ? (
            <Check className="size-3.5" />
          ) : (
            <Copy className="size-3.5" />
          )}
          {copied === "cmd"
            ? "Command copied (includes real token)"
            : "Copy wrangler command"}
        </Button>
        <p className="text-[11px] text-muted-foreground">
          Run from the unzipped install folder after{" "}
          <span className="font-mono">npm install</span>. Rotating here means
          you must run the new command on Cloudflare again before Verify.
        </p>
      </div>
    </div>
  );
}
