"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  WORKER_INSTALL_MANIFEST_URL,
  WORKER_INSTALL_ZIP_URL,
  type WorkerInstallManifest,
} from "@/lib/desktop/bridge";

/** Install-only AUTH_PEPPER. Not the owner passtoken. Never persist. */
function generateAuthPepper(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function workerUpdateCommand(zipUrl: string): string {
  return [
    `curl -L -o relaybase-worker-install.zip '${zipUrl}'`,
    `unzip -o relaybase-worker-install.zip -d relaybase-worker-install`,
    `cd relaybase-worker-install/relaybase-worker-install || cd relaybase-worker-install`,
    `npx wrangler deploy`,
  ].join("\n");
}

function fullInstallCommand(
  pepper: string,
  zipUrl: string,
  cf?: { accountId: string },
): string {
  const escaped = pepper.replace(/'/g, `'\\''`);
  const lines = [
    `curl -L -o relaybase-worker-install.zip '${zipUrl}'`,
    `unzip -o relaybase-worker-install.zip -d relaybase-worker-install`,
    `cd relaybase-worker-install/relaybase-worker-install || cd relaybase-worker-install`,
    `npx wrangler r2 bucket create relaybase-mailbox`,
    `npx wrangler d1 create relaybase-logs`,
    `npx wrangler d1 create relaybase-mail`,
    `npx wrangler d1 create relaybase-db`,
    `# paste each database_id into wrangler.toml (REPLACE_WITH_* placeholders)`,
    `printf '%s' '${escaped}' | npx wrangler secret put AUTH_PEPPER`,
  ];
  if (cf?.accountId.trim()) {
    const acct = cf.accountId.replace(/'/g, `'\\''`);
    lines.push(`printf '%s' '${acct}' | npx wrangler secret put CF_ACCOUNT_ID`);
  } else {
    lines.push(`# Optional: CF_ACCOUNT_ID for domain API`);
    lines.push(
      `# printf '%s' '<account-id>' | npx wrangler secret put CF_ACCOUNT_ID`,
    );
  }
  lines.push(
    `# Add CF_API_TOKEN (Email Sending / Routing / Zone Read) in the Cloudflare dashboard — do not paste it here.`,
  );
  lines.push(`npx wrangler deploy`);
  lines.push(
    `curl -X POST https://relaybase-api.<subdomain>.workers.dev/console/init-db -H 'X-Auth-Pepper: ${escaped}' -H 'Content-Type: application/json' -d '{}'`,
  );
  return lines.join("\n");
}

async function copyText(value: string): Promise<void> {
  await navigator.clipboard.writeText(value);
}

/**
 * Manual install / Worker-update script. AUTH_PEPPER is bootstrap only —
 * the owner secret the user keeps is the passtoken issued after deploy.
 */
export function ManualInstallScriptPanel({
  onPepperChange,
  cfAccountId,
  variant = "install",
}: {
  onPepperChange?: (pepper: string) => void;
  cfAccountId?: string;
  variant?: "install" | "worker-update";
}) {
  const [copied, setCopied] = useState(false);
  const [zipUrl, setZipUrl] = useState(WORKER_INSTALL_ZIP_URL);
  const [pepper, setPepper] = useState("");

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
    if (variant !== "install") return;
    const next = generateAuthPepper();
    setPepper(next);
    onPepperChange?.(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant]);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);

  const commandPreview =
    variant === "worker-update"
      ? workerUpdateCommand(zipUrl)
      : pepper
        ? fullInstallCommand(pepper, zipUrl, {
            accountId: cfAccountId ?? "",
          })
        : "Preparing install command…";

  async function copyCommand() {
    if (variant === "install" && !pepper) return;
    await copyText(commandPreview);
    setCopied(true);
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">
          {variant === "worker-update"
            ? "Worker update command"
            : "Full install command"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {variant === "worker-update"
            ? "Copy the command, deploy, then come back. Schema updates use your owner session — do not put a token in the script."
            : "Copy the command and run it in a terminal. After deploy, the app issues an owner passtoken — that is what you keep, not a wrangler secret."}
        </p>
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
            disabled={variant === "install" && !pepper}
            onClick={() => void copyCommand()}
          >
            {copied ? (
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
          {variant === "worker-update" ? (
            ", come back and tap “I'm done”. Use Settings → Update Worker (Recommended) to apply schema."
          ) : (
            <>
              {" "}
              prints your <span className="font-mono">*.workers.dev</span> URL,
              come back and tap &ldquo;I&apos;m done&rdquo;. The Worker then
              issues your passtoken once.
            </>
          )}
        </p>
      </div>
    </div>
  );
}

/** @deprecated Use ManualInstallScriptPanel */
export const AdminTokenPanel = ManualInstallScriptPanel;
