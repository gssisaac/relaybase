"use client";

import { useEffect, useState, useCallback } from "react";
import { Check, ChevronDown, ChevronUp, ExternalLink, Key, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  CF_API_TOKENS_URL,
  desktopPushServerToken,
  desktopVerifyCfToken,
  desktopVerifyWorkerConnection,
  desktopOpenExternal,
} from "@/lib/desktop/bridge";

export function Step1EmailApiCard({
  workerUrl,
  accountId,
  workerScriptName = "relaybase-api",
  onComplete,
}: {
  workerUrl: string;
  accountId: string;
  workerScriptName?: string;
  onComplete: () => void;
}) {
  const [checking, setChecking] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  const checkStatus = useCallback(async () => {
    if (!workerUrl) {
      setChecking(false);
      return;
    }
    setChecking(true);
    setError(null);
    try {
      const res = await desktopVerifyWorkerConnection(workerUrl);
      if (res.cfApiTokenSet && res.cfApiTokenValid !== false) {
        setIsVerified(true);
      } else {
        setIsVerified(false);
      }
    } catch {
      setIsVerified(false);
    } finally {
      setChecking(false);
    }
  }, [workerUrl]);

  useEffect(() => {
    void checkStatus();
  }, [checkStatus]);

  async function handleSaveToken(e: React.FormEvent) {
    e.preventDefault();
    const token = tokenInput.trim();
    if (!token) {
      setError("Please enter a Cloudflare API token.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (accountId) {
        const verifyRes = await desktopVerifyCfToken(accountId, token, "server").catch(() => null);
        if (verifyRes && !verifyRes.ok) {
          setError(verifyRes.message || "Cloudflare rejected the API token. Please verify permissions.");
          setSubmitting(false);
          return;
        }
      }

      await desktopPushServerToken(token, {
        accountId: accountId || undefined,
        workerScriptName,
      });

      if (workerUrl) {
        const check = await desktopVerifyWorkerConnection(workerUrl);
        if (!check.cfApiTokenSet) {
          throw new Error("Token was saved, but Worker has not loaded the secret yet. Please try again.");
        }
      }

      setIsVerified(true);
      toast.success("Cloudflare Email API configured and verified!");
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to push API token to Worker.");
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
        <Loader2 className="size-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Checking Cloudflare Email API status on Worker…</p>
      </div>
    );
  }

  if (isVerified) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-950 dark:text-emerald-100">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-emerald-500/20 p-1.5 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="size-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm sm:text-base">Email API is Active</h3>
                <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[11px]">
                  Verified
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Your Worker has a valid <span className="font-mono text-foreground">CF_API_TOKEN</span> secret. Relaybase can manage Cloudflare Email Routing rules and DNS records for your domains.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" onClick={onComplete} className="w-full sm:w-auto">
            Continue to Domain Setup
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <h2 className="text-base font-semibold tracking-tight sm:text-lg">
          Step 1: Enable Cloudflare Email API
        </h2>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Relaybase needs a Cloudflare API token (<span className="font-mono text-foreground font-medium">CF_API_TOKEN</span>) to configure Email Routing and DNS records automatically.
        </p>
      </div>

      <form onSubmit={handleSaveToken} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="cf-token-input" className="text-xs font-medium sm:text-sm">
            Cloudflare API Token
          </Label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
              <Key className="size-4" />
            </div>
            <Input
              id="cf-token-input"
              type="password"
              placeholder="Paste your Cloudflare API token here"
              value={tokenInput}
              onChange={(e) => {
                setTokenInput(e.target.value);
                setError(null);
              }}
              className="pl-9 font-mono text-xs sm:text-sm"
              autoComplete="off"
              spellCheck={false}
              autoFocus
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <Button type="submit" disabled={submitting || !tokenInput.trim()} className="w-full">
          {submitting ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Saving & Verifying…
            </>
          ) : (
            "Save & Verify API Token"
          )}
        </Button>
      </form>

      {/* Cloudflare Guide Accordion */}
      <div className="rounded-lg border bg-muted/20 text-xs sm:text-sm">
        <button
          type="button"
          onClick={() => setShowGuide(!showGuide)}
          className="flex w-full items-center justify-between p-3.5 text-left font-medium text-foreground hover:bg-muted/40 transition-colors rounded-lg"
        >
          <span className="flex items-center gap-2">
            <span>How to create a Cloudflare API Token</span>
          </span>
          {showGuide ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
        </button>

        {showGuide && (
          <div className="border-t p-3.5 space-y-3 bg-card/40">
            <p className="text-xs text-muted-foreground">
              1. Open Cloudflare API Tokens and select <strong>Create Custom Token</strong>:
            </p>
            <div className="space-y-1.5 rounded border bg-background p-3 text-xs">
              <p className="font-semibold text-foreground">5 Required Permissions:</p>
              <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                <li><span className="text-foreground">Zone</span> → <span className="text-foreground">Email Routing Rules</span> → <strong>Edit</strong></li>
                <li><span className="text-foreground">Zone</span> → <span className="text-foreground">Zone Settings</span> → <strong>Edit</strong></li>
                <li><span className="text-foreground">Zone</span> → <span className="text-foreground">Zone</span> → <strong>Read</strong></li>
                <li><span className="text-foreground">Zone</span> → <span className="text-foreground">DNS</span> → <strong>Edit</strong></li>
                <li><span className="text-foreground">Account</span> → <span className="text-foreground">Email Sending</span> → <strong>Edit</strong></li>
              </ul>
              <div className="pt-2">
                <span className="font-semibold text-foreground">Zone Resources:</span> <span className="text-muted-foreground">Include — All zones</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void desktopOpenExternal(CF_API_TOKENS_URL)}
              className="w-full gap-1.5 text-xs"
            >
              Open Cloudflare API Tokens Dashboard
              <ExternalLink className="size-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
