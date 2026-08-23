"use client";

import { ChevronDown, ExternalLink, Loader2, Shield } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CF_API_TOKENS_URL,
  CF_REQUIRED_TOKEN_PERMISSIONS,
  cloudflareWorkerSettingsUrl,
  desktopOpenExternal,
  desktopVerifyWorkerConnection,
  explainDesktopError,
  mailApiReady,
  type DesktopErrorHelp,
} from "@/lib/desktop/bridge";
import { DesktopErrorBanner } from "@/lib/desktop/DesktopErrorBanner";

export function EnableEmailApiDialog({
  open,
  onOpenChange,
  accountId,
  workerScriptName = "relaybase-api",
  workerUrl,
  adminToken,
  allowSkip = false,
  onVerified,
  onSkip,
  onPasteAndPush,
  pasteBusy = false,
  pasteError = null,
  pasteMessage = null,
  cfInstallTokenAvailable = false,
  oauthBusy = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  workerScriptName?: string;
  workerUrl: string;
  adminToken: string;
  allowSkip?: boolean;
  onVerified: () => void;
  onSkip?: () => void;
  onPasteAndPush?: (token: string) => Promise<void>;
  pasteBusy?: boolean;
  pasteError?: DesktopErrorHelp | null;
  pasteMessage?: string | null;
  cfInstallTokenAvailable?: boolean;
  oauthBusy?: boolean;
}) {
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyError, setVerifyError] = useState<DesktopErrorHelp | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteToken, setPasteToken] = useState("");

  const settingsUrl = cloudflareWorkerSettingsUrl(accountId, workerScriptName);
  const busy = verifyBusy || pasteBusy || oauthBusy;

  useEffect(() => {
    if (!open || !pasteMessage) return;
    if (
      pasteMessage.includes("pushed to the Worker") ||
      pasteMessage.includes("verified and saved")
    ) {
      onVerified();
      onOpenChange(false);
    }
  }, [open, pasteMessage, onVerified, onOpenChange]);

  async function handleVerify() {
    setVerifyBusy(true);
    setVerifyError(null);
    try {
      const url = workerUrl.trim();
      const token = adminToken.trim();
      if (!url || !token) {
        throw new Error("Worker URL and admin token are required to verify.");
      }
      const result = await desktopVerifyWorkerConnection(url, token);
      if (!result.cfApiTokenSet) {
        throw new Error(
          "The Worker has no CF_API_TOKEN secret yet. Add it under Runtime variables and secrets, then try again.",
        );
      }
      if (result.cfApiTokenValid === false) {
        throw new Error(
          "CF_API_TOKEN is set but Cloudflare rejected it. Check permissions (Email Sending Edit, Email Routing Rules Edit, Zone Read) and try again.",
        );
      }
      if (!mailApiReady(result)) {
        throw new Error("Cloudflare API is not ready on this Worker.");
      }
      onVerified();
      onOpenChange(false);
    } catch (err) {
      setVerifyError(explainDesktopError(err, "Could not verify Cloudflare API"));
    } finally {
      setVerifyBusy(false);
    }
  }

  async function handlePaste() {
    if (!onPasteAndPush || !pasteToken.trim()) return;
    setVerifyError(null);
    try {
      await onPasteAndPush(pasteToken.trim());
      if (cfInstallTokenAvailable) {
        onVerified();
        onOpenChange(false);
      }
    } catch {
      /* parent surfaces pasteError */
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enable email API on your Worker</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Create an API token in Cloudflare and add it as the{" "}
          <span className="font-mono">CF_API_TOKEN</span> Worker secret. Relaybase
          does not store the token on this Mac. Sending uses the Worker{" "}
          <span className="font-mono">EMAIL</span> binding; this token is for
          domains, inbox routing, and DNS.
        </p>

        <img
          src="/setup/cf-worker-runtime-secrets.png"
          alt="Cloudflare Worker Runtime variables and secrets. Type Secret, name CF_API_TOKEN."
          className="w-full rounded-md border border-border"
        />

        <div className="space-y-3 text-xs">
          <div className="space-y-1.5">
            <p className="font-medium text-foreground">a. Create an API token</p>
            <p className="text-muted-foreground">
              In Cloudflare, create a custom token with these permissions:
            </p>
            <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
              {CF_REQUIRED_TOKEN_PERMISSIONS.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-brand hover:underline"
              onClick={() => void desktopOpenExternal(CF_API_TOKENS_URL)}
            >
              Create token in Cloudflare
              <ExternalLink className="size-3" />
            </button>
          </div>

          <div className="space-y-1.5">
            <p className="font-medium text-foreground">
              b. Add it as a Worker secret
            </p>
            <p className="text-muted-foreground">
              Open Worker settings → Runtime variables and secrets → Add
              variable. Type ={" "}
              <span className="font-medium text-foreground">Secret</span>, Name ={" "}
              <span className="font-mono text-foreground">CF_API_TOKEN</span>,
              Value = the token you just created.{" "}
              <span className="font-mono">CF_ACCOUNT_ID</span> is already set
              from install.
            </p>
            <button
              type="button"
              className="inline-flex items-center gap-1 break-all text-left text-brand hover:underline"
              onClick={() => void desktopOpenExternal(settingsUrl)}
              disabled={!accountId.trim()}
            >
              Open Worker settings
              <ExternalLink className="size-3 shrink-0" />
            </button>
          </div>
        </div>

        <DesktopErrorBanner error={verifyError} />
        <DesktopErrorBanner error={pasteError} />
        {pasteMessage ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-400">
            {pasteMessage}
          </p>
        ) : null}

        {onPasteAndPush ? (
          <div className="rounded-md border border-border">
            <button
              type="button"
              className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium"
              onClick={() => setPasteOpen((v) => !v)}
            >
              Or paste a token and push from this app
              <ChevronDown
                className={`size-3.5 text-muted-foreground transition-transform ${
                  pasteOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            {pasteOpen ? (
              <div className="space-y-2 border-t border-border px-3 py-3">
                <div className="flex items-start gap-2 text-[11px] text-muted-foreground">
                  <Shield className="mt-0.5 size-3.5 shrink-0" />
                  Optional. The token is verified, then pushed to the Worker as
                  a secret. Prefer the dashboard steps above if you do not want
                  the value on this Mac.
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="enable-email-paste-token">Server token</Label>
                  <Input
                    id="enable-email-paste-token"
                    type="password"
                    value={pasteToken}
                    onChange={(e) => setPasteToken(e.target.value)}
                    placeholder="Email Sending Edit token"
                    className="font-mono text-xs"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!pasteToken.trim() || busy}
                  onClick={() => void handlePaste()}
                >
                  {pasteBusy || oauthBusy ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : null}
                  {cfInstallTokenAvailable
                    ? "Verify, save & push"
                    : "Authorize & push"}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            type="button"
            className="w-full"
            disabled={busy || !workerUrl.trim() || !adminToken.trim()}
            onClick={() => void handleVerify()}
          >
            {verifyBusy ? <Loader2 className="size-3.5 animate-spin" /> : null}
            I have done this — verify
          </Button>
          {allowSkip ? (
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={busy}
              onClick={() => {
                onSkip?.();
                onOpenChange(false);
              }}
            >
              Do this later in Settings
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
