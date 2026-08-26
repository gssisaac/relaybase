"use client";

import { ChevronLeft, ChevronRight, ExternalLink, Loader2, Shield } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CF_API_TOKENS_URL,
  CF_REQUIRED_TOKEN_PERMISSIONS,
  cloudflareWorkerSettingsUrl,
  desktopOpenExternal,
  desktopVerifyWorkerConnection,
  explainDesktopError,
  isCloudflareAuthExpired,
  mailApiReady,
  type DesktopErrorHelp,
} from "@/lib/desktop/bridge";
import { DesktopErrorBanner } from "@/lib/desktop/DesktopErrorBanner";

function CreateCustomTokenGuide() {
  return (
    <div className="space-y-3">
      <img
        src="/setup/cf-create-custom-token.png"
        alt="Cloudflare Create API Token page. Custom token section with Get started."
        className="w-full rounded-md border border-border"
      />
      <p className="text-xs text-muted-foreground">
        Open Create API Token and use{" "}
        <span className="font-medium text-foreground">Custom token</span>. Click{" "}
        <span className="font-medium text-foreground">Get started</span>, then
        grant these permissions:
      </p>
      <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
        {CF_REQUIRED_TOKEN_PERMISSIONS.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <button
        type="button"
        className="inline-flex items-center gap-1 text-xs text-brand hover:underline"
        onClick={() => void desktopOpenExternal(CF_API_TOKENS_URL)}
      >
        Create token in Cloudflare
        <ExternalLink className="size-3" />
      </button>
    </div>
  );
}

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
  onPasteAndPush?: (token: string) => Promise<boolean | void>;
  pasteBusy?: boolean;
  pasteError?: DesktopErrorHelp | null;
  pasteMessage?: string | null;
  cfInstallTokenAvailable?: boolean;
  oauthBusy?: boolean;
}) {
  const [mode, setMode] = useState<"manual" | "oauth">("manual");
  const [step, setStep] = useState(0);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyError, setVerifyError] = useState<DesktopErrorHelp | null>(null);
  const [pasteToken, setPasteToken] = useState("");

  const settingsUrl = cloudflareWorkerSettingsUrl(accountId, workerScriptName);
  const busy = verifyBusy || pasteBusy || oauthBusy;
  const canVerify = Boolean(workerUrl.trim() && adminToken.trim());

  useEffect(() => {
    if (!open) return;
    setMode("manual");
    setStep(0);
    setVerifyError(null);
    setPasteToken("");
  }, [open]);

  useEffect(() => {
    if (!open || !pasteMessage) return;
    if (
      pasteMessage.includes("pushed to the Worker") ||
      pasteMessage.includes("verified and pushed") ||
      pasteMessage.includes("Server token verified.")
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
      const done = await onPasteAndPush(pasteToken.trim());
      // OAuth-first paste returns false and finishes later via pasteMessage / host.
      if (done !== false && cfInstallTokenAvailable) {
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
        <DialogHeader className="flex-row items-start justify-between gap-3 pr-8">
          <DialogTitle className="pt-0.5">Enable email API on your Worker</DialogTitle>
          <Tabs
            value={mode}
            onValueChange={(v) => {
              setMode(v === "oauth" ? "oauth" : "manual");
              setVerifyError(null);
            }}
          >
            <TabsList>
              <TabsTrigger value="manual">Manual</TabsTrigger>
              <TabsTrigger value="oauth">By OAuth</TabsTrigger>
            </TabsList>
          </Tabs>
        </DialogHeader>

        {mode === "manual" ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Create an API token in Cloudflare and add it as the{" "}
              <span className="font-mono">CF_API_TOKEN</span> Worker secret.
              Relaybase does not store the token on this Mac.
            </p>
            <div className="overflow-hidden">
              <div
                className="flex transition-transform duration-300 ease-out"
                style={{ transform: `translateX(-${step * 100}%)` }}
              >
                <div className="w-full shrink-0 pr-1">
                  <Card size="sm">
                    <CardHeader>
                      <p className="text-[11px] text-muted-foreground">Step 1 of 2</p>
                      <CardTitle>Create an API token</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CreateCustomTokenGuide />
                    </CardContent>
                  </Card>
                </div>
                <div className="w-full shrink-0 pl-1">
                  <Card size="sm">
                    <CardHeader>
                      <p className="text-[11px] text-muted-foreground">Step 2 of 2</p>
                      <CardTitle>Add it as a Worker secret</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <img
                        src="/setup/cf-worker-runtime-secrets.png"
                        alt="Cloudflare Worker Runtime variables and secrets. Type Secret, name CF_API_TOKEN."
                        className="w-full rounded-md border border-border"
                      />
                      <p className="text-xs text-muted-foreground">
                        Open Worker settings → Runtime variables and secrets →
                        Add variable. Type ={" "}
                        <span className="font-medium text-foreground">Secret</span>
                        , Name ={" "}
                        <span className="font-mono text-foreground">
                          CF_API_TOKEN
                        </span>
                        , Value = the token you just created.{" "}
                        <span className="font-mono">CF_ACCOUNT_ID</span> is
                        already set from install.
                      </p>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 break-all text-left text-xs text-brand hover:underline"
                        onClick={() => void desktopOpenExternal(settingsUrl)}
                        disabled={!accountId.trim()}
                      >
                        Open Worker settings
                        <ExternalLink className="size-3 shrink-0" />
                      </button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-center gap-1.5">
              <button
                type="button"
                aria-label="Previous step"
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                disabled={step === 0}
                onClick={() => setStep(0)}
              >
                <ChevronLeft className="size-4" />
              </button>
              {[0, 1].map((i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Go to step ${i + 1}`}
                  className={`size-1.5 rounded-full ${
                    step === i ? "bg-foreground" : "bg-muted-foreground/30"
                  }`}
                  onClick={() => setStep(i)}
                />
              ))}
              <button
                type="button"
                aria-label="Next step"
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                disabled={step === 1}
                onClick={() => setStep(1)}
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Create the same Custom token, paste it here, and Relaybase pushes
              it to the Worker as{" "}
              <span className="font-mono">CF_API_TOKEN</span>. If this Mac has
              no install session, Cloudflare authorization opens first.
            </p>
            <CreateCustomTokenGuide />
            {onPasteAndPush ? (
              <div className="space-y-3">
                <div className="flex items-start gap-2 text-[11px] text-muted-foreground">
                  <Shield className="mt-0.5 size-3.5 shrink-0" />
                  The token is verified, then pushed. Prefer Manual if you do
                  not want the value on this Mac.
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
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Paste and push is not available in this step. Use Manual to add
                the secret in the Cloudflare dashboard.
              </p>
            )}
          </div>
        )}

        <DesktopErrorBanner
          error={isCloudflareAuthExpired(verifyError) ? null : verifyError}
        />
        <DesktopErrorBanner
          error={isCloudflareAuthExpired(pasteError) ? null : pasteError}
        />
        {pasteMessage ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-400">
            {pasteMessage}
          </p>
        ) : null}

        <DialogFooter className="flex-col gap-2 sm:flex-col sm:justify-stretch">
          {mode === "manual" && step === 0 ? (
            <Button
              type="button"
              className="w-full"
              onClick={() => setStep(1)}
            >
              Next
              <ChevronRight className="size-3.5" />
            </Button>
          ) : null}
          {mode === "manual" && step === 1 ? (
            <div className="flex w-full gap-2">
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                disabled={busy}
                onClick={() => setStep(0)}
              >
                <ChevronLeft className="size-3.5" />
                Back
              </Button>
              <Button
                type="button"
                className="min-w-0 flex-1"
                disabled={busy || !canVerify}
                onClick={() => void handleVerify()}
              >
                {verifyBusy ? <Loader2 className="size-3.5 animate-spin" /> : null}
                I have done this — verify
              </Button>
            </div>
          ) : null}
          {mode === "oauth" && onPasteAndPush ? (
            <Button
              type="button"
              className="w-full"
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
          ) : null}
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
