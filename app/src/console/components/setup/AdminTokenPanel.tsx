"use client";

import { Check, Copy, Download, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import {
  desktopSaveDownloadFile,
  isDesktopRuntime,
  WORKER_INSTALL_ZIP_URL,
  fetchWorkerInstallManifest,
} from "@/lib/desktop/bridge";
import { parseDefaultWorkerSubdomain } from "@/lib/desktop/worker-url/worker-url";
import { cn } from "@/lib/utils";

import {
  buildStorageInitCommand,
  buildVerifyCommand,
  buildWorkerInstallCommand,
  buildWranglerInstallCommand,
  resolveManualWorkerUrl,
  workerUpdateCommand,
} from "./manual-install-command";

/** Install-only AUTH_PEPPER. Not the owner passtoken. Never persist. */
function generateAuthPepper(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function copyText(value: string): Promise<void> {
  await navigator.clipboard.writeText(value);
}

function downloadBlob(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(href);
}

function CommandBlock({
  title,
  titleClassName,
  command,
  canCopy,
  copyLabel,
}: {
  title: string;
  titleClassName?: string;
  command: string;
  canCopy: boolean;
  copyLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className={cn("text-xs font-medium text-foreground", titleClassName)}>
          {title}
        </p>
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          aria-label={copyLabel}
          disabled={!canCopy}
          onClick={() => {
            void copyText(command).then(() => setCopied(true));
          }}
        >
          {copied ? (
            <Check className="size-3.5" />
          ) : (
            <Copy className="size-3.5" />
          )}
        </Button>
      </div>
      <pre className="overflow-x-auto rounded bg-black/80 p-3 font-mono text-[11px] leading-relaxed text-emerald-300">
        {command}
      </pre>
    </div>
  );
}

/**
 * Manual install / Worker-update script. AUTH_PEPPER is bootstrap only —
 * the owner secret the user keeps is the passtoken issued after deploy.
 */
export function ManualInstallScriptPanel({
  onPepperChange,
  cfAccountId,
  workerUrl = "",
  onWorkerUrlChange,
  variant = "install",
}: {
  onPepperChange?: (pepper: string) => void;
  cfAccountId?: string;
  workerUrl?: string;
  onWorkerUrlChange?: (workerUrl: string) => void;
  variant?: "install" | "worker-update";
}) {
  const [zipUrl, setZipUrl] = useState(WORKER_INSTALL_ZIP_URL);
  const [pepper, setPepper] = useState("");
  const [copiedPepper, setCopiedPepper] = useState(false);
  const [downloadedPepper, setDownloadedPepper] = useState(false);
  const [subdomain, setSubdomain] = useState(
    () => parseDefaultWorkerSubdomain(workerUrl) ?? "",
  );

  useEffect(() => {
    let active = true;
    void fetchWorkerInstallManifest()
      .then((data) => {
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

  function applyPepper(next: string) {
    setPepper(next);
    onPepperChange?.(next);
    setCopiedPepper(false);
    setDownloadedPepper(false);
  }

  useEffect(() => {
    if (variant !== "install") return;
    applyPepper(generateAuthPepper());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant]);

  useEffect(() => {
    if (!copiedPepper) return;
    const t = window.setTimeout(() => setCopiedPepper(false), 2000);
    return () => window.clearTimeout(t);
  }, [copiedPepper]);

  useEffect(() => {
    const fromUrl = parseDefaultWorkerSubdomain(workerUrl);
    if (fromUrl && fromUrl !== subdomain) {
      setSubdomain(fromUrl);
    }
    // Seed from parent once; avoid fighting local typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workerUrl]);

  if (variant === "worker-update") {
    return (
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium">Worker update command</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Copy the command, deploy, then come back. Schema updates use your
            owner session — do not put a token in the script.
          </p>
        </div>
        <div className="space-y-2 rounded-md border border-border/80 bg-muted/30 p-3">
          <CommandBlock
            title="Worker update command"
            command={workerUpdateCommand(zipUrl)}
            canCopy
            copyLabel="Copy worker update command"
          />
          <p className="text-[11px] text-muted-foreground">
            Pre-built bundle — no <span className="font-mono">npm install</span>.
            After <span className="font-mono">wrangler deploy</span>, come back
            and tap “I&apos;m done”. Use Settings → Update Worker (Recommended)
            to apply schema.
          </p>
        </div>
      </div>
    );
  }

  const resolvedUrl = resolveManualWorkerUrl(subdomain);
  const workerReady = Boolean(resolvedUrl);
  const installCommand = pepper
    ? buildWorkerInstallCommand({
        pepper,
        zipUrl,
        accountId: cfAccountId,
      })
    : "Preparing install command…";
  const storageCommand = pepper
    ? buildStorageInitCommand({
        pepper,
        workerUrl: subdomain,
      })
    : "Preparing D1 / R2 command…";
  const verifyCommand = buildVerifyCommand(subdomain);

  function handleSubdomainChange(next: string) {
    setSubdomain(next);
    onWorkerUrlChange?.(resolveManualWorkerUrl(next));
  }

  async function copyPepper() {
    if (!pepper) return;
    await copyText(pepper);
    setCopiedPepper(true);
  }

  async function downloadPepper() {
    if (!pepper) return;
    const content = [
      "# Relaybase AUTH_PEPPER — save this file securely",
      `# Worker URL: ${resolvedUrl || "https://relaybase-api.<subdomain>.workers.dev"}`,
      `# Generated: ${new Date().toISOString()}`,
      "",
      `AUTH_PEPPER=${pepper}`,
      "",
    ].join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const filename = "relaybase-auth-pepper.txt";
    if (isDesktopRuntime()) {
      const buffer = await blob.arrayBuffer();
      await desktopSaveDownloadFile(filename, new Uint8Array(buffer));
    } else {
      downloadBlob(blob, filename);
    }
    setDownloadedPepper(true);
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium">Manual install</p>
        <p className="mt-1 text-xs text-muted-foreground">
          If Wrangler is not installed, start with step 1. Confirm{" "}
          <span className="font-mono">whoami</span> is the account you want.
          Worker overwrite is fine.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="manual-worker-subdomain">
          workers.dev subdomain{" "}
          <span className="font-normal text-muted-foreground">(for D1 init)</span>
        </Label>
        <Input
          id="manual-worker-subdomain"
          value={subdomain}
          onChange={(e) => handleSubdomainChange(e.target.value)}
          placeholder="your-subdomain"
          className="font-mono text-xs"
          autoComplete="off"
        />
        <p className="text-[11px] text-muted-foreground">
          Completes{" "}
          <span className="font-mono break-all">
            {resolvedUrl ||
              "https://relaybase-api.<subdomain>.workers.dev"}
          </span>
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="manual-passtoken">Passtoken</Label>
        <InputGroup>
          <InputGroupInput
            id="manual-passtoken"
            value={pepper}
            readOnly
            className="font-mono text-xs"
            autoComplete="off"
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="icon-xs"
              aria-label="Rotate passtoken"
              disabled={!pepper}
              onClick={() => applyPepper(generateAuthPepper())}
            >
              <RefreshCw className="size-3.5" />
            </InputGroupButton>
            <InputGroupButton
              size="icon-xs"
              aria-label="Copy passtoken"
              disabled={!pepper}
              onClick={() => void copyPepper()}
            >
              {copiedPepper ? (
                <Check className="size-3.5" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </InputGroupButton>
            <InputGroupButton
              size="icon-xs"
              aria-label="Download passtoken"
              disabled={!pepper}
              variant={downloadedPepper ? "default" : "ghost"}
              onClick={() => void downloadPepper()}
            >
              {downloadedPepper ? (
                <Check className="size-3.5" />
              ) : (
                <Download className="size-3.5" />
              )}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <p className="text-[11px] text-muted-foreground">
          Save a copy. Rotating updates the commands below. The Worker issues
          your owner login after verify.
        </p>
      </div>

      <div className="space-y-2 rounded-md border border-border/80 bg-muted/30 p-3">
        <CommandBlock
          title="1. Install Wrangler"
          command={buildWranglerInstallCommand()}
          canCopy
          copyLabel="Copy Wrangler install command"
        />
        <p className="text-[11px] text-muted-foreground">
          Needs Node.js 20+. Skip this step if{" "}
          <span className="font-mono">npx wrangler</span> already works.
        </p>
      </div>

      <div className="space-y-2 rounded-md border border-border/80 bg-muted/30 p-3">
        <CommandBlock
          title="2. Worker install"
          command={installCommand}
          canCopy={Boolean(pepper)}
          copyLabel="Copy worker install command"
        />
        <p className="text-[11px] text-muted-foreground">
          Pre-built bundle — no <span className="font-mono">npm install</span>.
          Deploy overwrites Worker{" "}
          <span className="font-mono">relaybase-api</span> on the logged-in
          account. If <span className="font-mono">wrangler.toml</span> still has{" "}
          <span className="font-mono">REPLACE_WITH_*</span> D1 ids, finish step 3
          and deploy again.
        </p>
      </div>

      <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
        <CommandBlock
          title="3. D1 & R2 — Be careful if you already have these"
          titleClassName="text-amber-800 dark:text-amber-300"
          command={storageCommand}
          canCopy={Boolean(pepper) && workerReady}
          copyLabel="Copy D1 and R2 command"
        />
        <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90">
          If <span className="font-mono">relaybase-mailbox</span> or{" "}
          <span className="font-mono">relaybase-*</span> D1 already exist, skip{" "}
          <span className="font-mono">create</span> and paste those ids. Do not
          delete. Then deploy so bindings apply.{" "}
          <span className="font-mono">init-db</span> is for empty D1 only (409
          means tables already exist — leave them).
        </p>
      </div>

      <div className="space-y-2 rounded-md border border-border/80 bg-muted/30 p-3">
        <CommandBlock
          title="4. Verify (optional)"
          command={verifyCommand}
          canCopy={workerReady}
          copyLabel="Copy verify command"
        />
        <p className="text-[11px] text-muted-foreground">
          After deploy is live,{" "}
          <span className="font-mono">/health</span> should succeed. Then tap
          “I&apos;m done” if you want the app to issue your owner login.
        </p>
      </div>
    </div>
  );
}

/** @deprecated Use ManualInstallScriptPanel */
export const AdminTokenPanel = ManualInstallScriptPanel;
