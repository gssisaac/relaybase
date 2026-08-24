"use client";

import { Check, Copy, Info, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  WORKER_INSTALL_MANIFEST_URL,
  WORKER_INSTALL_ZIP_URL,
  type WorkerInstallManifest,
} from "@/lib/desktop/bridge";

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
 * Build the full one-shot manual install script: download pre-built bundle +
 * wrangler R2/D1/secret/deploy. No npm install — the ZIP contains worker.js.
 */
function workerUpdateCommand(token: string, zipUrl: string): string {
  const escaped = token.replace(/'/g, `'\\''`);
  return [
    `curl -L -o relaybase-worker-install.zip '${zipUrl}'`,
    `unzip -o relaybase-worker-install.zip -d relaybase-worker-install`,
    `cd relaybase-worker-install/relaybase-worker-install || cd relaybase-worker-install`,
    `npx wrangler deploy`,
    `curl -X POST https://relaybase-api.<subdomain>.workers.dev/console/migrate-db -H 'Authorization: Bearer ${escaped}' -H 'Content-Type: application/json' -d '{}'`,
  ].join("\n");
}

function fullInstallCommand(
  token: string,
  zipUrl: string,
  cf?: { accountId: string; serverToken: string },
): string {
  const escaped = token.replace(/'/g, `'\\''`);
  const lines = [
    `curl -L -o relaybase-worker-install.zip '${zipUrl}'`,
    `unzip -o relaybase-worker-install.zip -d relaybase-worker-install`,
    `cd relaybase-worker-install/relaybase-worker-install || cd relaybase-worker-install`,
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
    lines.push(`printf '%s' '${tok}' | npx wrangler secret put CF_API_TOKEN`);
  } else {
    lines.push(
      `# Optional: CF_ACCOUNT_ID + CF_API_TOKEN (Email Sending / Routing / Zone Read) for domain API`,
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
  variant = "install",
  allowRotate = true,
}: {
  value: string;
  onChange: (token: string) => void;
  cfAccountId?: string;
  cfServerToken?: string;
  variant?: "install" | "worker-update";
  allowRotate?: boolean;
}) {
  const [copied, setCopied] = useState<"cmd" | "token" | null>(null);
  const [zipUrl, setZipUrl] = useState(WORKER_INSTALL_ZIP_URL);

  useEffect(() => {
    let active = true;
    void fetch(WORKER_INSTALL_MANIFEST_URL, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: WorkerInstallManifest | null) => {
        if (active && data?.zipUrl?.trim()) {
          setZipUrl(data.zipUrl.trim());
        }
      })
      .catch(() => {
        /* fallback to stable URL */
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(null), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);

  function rotate() {
    onChange(generateAdminToken());
    setCopied(null);
  }

  const commandPreview = value
    ? variant === "worker-update"
      ? workerUpdateCommand(value, zipUrl)
      : fullInstallCommand(value, zipUrl, {
          accountId: cfAccountId ?? "",
          serverToken: cfServerToken ?? "",
        })
    : "Generate a token to reveal the full command.";

  async function copyCommand() {
    if (!value) return;
    await copyText(commandPreview);
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
          {allowRotate ? (
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              aria-label={value.trim() ? "Rotate admin token" : "Generate admin token"}
              onClick={rotate}
            >
              <RefreshCw className="size-3.5" />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="space-y-2 rounded-md border border-border/80 bg-muted/30 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-foreground">
            {variant === "worker-update"
              ? "Worker update command"
              : "Full install command"}
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
          {commandPreview}
        </pre>
        <p className="text-[11px] text-muted-foreground">
          Pre-built bundle — no <span className="font-mono">npm install</span>.
          After <span className="font-mono">wrangler deploy</span>
          {variant === "worker-update"
            ? ", wait a few seconds, then run migrate-db. Do not call init-db."
            : <>
                {" "}prints your{" "}
                <span className="font-mono">*.workers.dev</span> URL, come back and tap
                &ldquo;I&apos;m done&rdquo;.
              </>}
        </p>
      </div>
    </div>
  );
}
