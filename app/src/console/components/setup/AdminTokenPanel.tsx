"use client";

import { Check, Copy, Info, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
 * + wrangler R2/D1/secret/deploy. The admin token is embedded so the user
 * copies one block and runs it in a terminal. When Cloudflare credentials are
 * supplied (from ~/.relaybase), they are also pushed as Worker secrets so the
 * Worker can send mail.
 */
function fullInstallCommand(
  token: string,
  zipUrl: string,
  cf?: { accountId: string; serverToken: string },
): string {
  const escaped = token.replace(/'/g, `'\\''`);
  const lines = [
    `curl -L -o relaybase-worker-install.zip '${zipUrl}'`,
    `unzip -o relaybase-worker-install.zip -d relaybase-worker-install`,
    `cd relaybase-worker-install`,
    `npm install`,
    `npx wrangler r2 bucket create relaybase-mailbox`,
    `npx wrangler d1 create relaybase-logs`,
    `npx wrangler d1 create relaybase-inbox-index`,
    `npx wrangler d1 create relaybase-db`,
    `# paste each database_id into wrangler.toml (REPLACE_WITH_* placeholders)`,
    `printf '%s' '${escaped}' | npx wrangler secret put ADMIN_TOKEN`,
  ];
  if (cf?.accountId.trim() && cf?.serverToken.trim()) {
    const acct = cf.accountId.replace(/'/g, `'\\''`);
    const tok = cf.serverToken.replace(/'/g, `'\\''`);
    lines.push(`printf '%s' '${acct}' | npx wrangler secret put CF_ACCOUNT_ID`);
    // The server token (Email Sending Edit) is what authorizes the Worker to
    // send mail — never embed the install token here.
    lines.push(`printf '%s' '${tok}' | npx wrangler secret put CF_API_TOKEN`);
  } else {
    lines.push(
      `# Optional: set CF_ACCOUNT_ID and a server token (Email Sending Edit) so the Worker can send mail`,
    );
    lines.push(
      `# printf '%s' '<account-id>' | npx wrangler secret put CF_ACCOUNT_ID`,
    );
    lines.push(
      `# printf '%s' '<server-token>' | npx wrangler secret put CF_API_TOKEN`,
    );
  }
  lines.push(`npx wrangler deploy`);
  lines.push(
    `curl -X POST https://relaybase-api.<subdomain>.workers.dev/console/init-db -H 'Authorization: Bearer ${escaped}' -H 'Content-Type: application/json' -d '{}'`,
  );
  return lines.join("\n");
}

async function copyText(value: string): Promise<void> {
  await navigator.clipboard.writeText(value);
}

export function AdminTokenPanel({
  value,
  onChange,
  cfAccountId,
  cfServerToken,
}: {
  value: string;
  onChange: (token: string) => void;
  cfAccountId?: string;
  cfServerToken?: string;
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
    await copyText(
      fullInstallCommand(value, WORKER_INSTALL_ZIP_URL, {
        accountId: cfAccountId ?? "",
        serverToken: cfServerToken ?? "",
      }),
    );
    setCopied("cmd");
  }

  async function copyTokenOnly() {
    if (!value) return;
    await copyText(value);
    setCopied("token");
  }

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium">Admin token</p>
          <Popover>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  aria-label="Admin token details"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Info className="size-3.5" />
                </button>
              }
            />
            <PopoverContent align="start" side="bottom" className="max-w-xs">
              <p className="text-xs text-muted-foreground">
                Not a Cloudflare API token. Generate one here (or paste a token
                you already set on the Worker). Copy the full command below, run
                it in a terminal, then come back and verify with the same token.
              </p>
            </PopoverContent>
          </Popover>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Generate or paste a token, then run the command below.
        </p>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
          {value ? maskToken(value) : "—"}
        </span>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            aria-label="Copy admin token"
            disabled={!value}
            onClick={() => void copyTokenOnly()}
          >
            {copied === "token" ? (
              <Check className="size-3.5" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            aria-label={value.trim() ? "Rotate admin token" : "Generate admin token"}
            onClick={rotate}
          >
            <RefreshCw className="size-3.5" />
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
            ? fullInstallCommand(value, WORKER_INSTALL_ZIP_URL, {
                accountId: cfAccountId ?? "",
                serverToken: cfServerToken ?? "",
              })
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
