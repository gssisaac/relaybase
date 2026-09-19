"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { ChevronDown, ChevronUp, ExternalLink, Key, Loader2, LogIn, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CfApiTokenDetailsSheet } from "@/console/pages/settings/cloudflare/CfApiTokenDetailsSheet";
import { validateCfApiTokenInput } from "@/lib/cloudflare/validate-cf-api-token";
import {
  CF_API_TOKENS_URL,
  desktopPushServerToken,
  desktopVerifyCfToken,
  desktopVerifyWorkerConnection,
  desktopOpenExternal,
  desktopStartCfOAuth,
  explainCfOAuthError,
  isCloudflareAuthExpired,
  listenCfOAuthResult,
} from "@/lib/desktop/bridge";
import { isDesktopRuntime } from "@/lib/desktop/bridge/invoke";
import { openWebCfOAuthPopup } from "@/lib/desktop/bridge/web-oauth-authorize";
import {
  PENDING_SERVER_TOKEN_PUSH_KEY,
} from "@/lib/desktop/bridge/web-oauth-complete";
import { useWebCfOAuthComplete } from "@/lib/desktop/bridge/use-web-cf-oauth-complete";

function needsCloudflareAuthorization(message: string | null): boolean {
  if (!message) return false;
  if (isCloudflareAuthExpired(message)) return true;
  return message.toLowerCase().includes("authorize with cloudflare");
}

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
  const [oauthBusy, setOauthBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const tokenRef = useRef("");

  const showAuthAction = needsCloudflareAuthorization(error);
  const busy = submitting || oauthBusy;

  useEffect(() => {
    tokenRef.current = tokenInput;
  }, [tokenInput]);

  useEffect(() => {
    let active = true;

    async function checkStatus() {
      if (!workerUrl) {
        if (active) setChecking(false);
        return;
      }
      try {
        const res = await desktopVerifyWorkerConnection(workerUrl);
        if (!active) return;
        if (res.cfApiTokenSet && res.cfApiTokenValid !== false) {
          setIsVerified(true);
        } else {
          setIsVerified(false);
        }
      } catch {
        if (active) setIsVerified(false);
      } finally {
        if (active) setChecking(false);
      }
    }

    void checkStatus();
    return () => {
      active = false;
    };
  }, [workerUrl]);

  const pushTokenToWorker = useCallback(
    async (token: string) => {
      const trimmed = token.trim();
      if (!trimmed) {
        setError("Please enter a Cloudflare API token.");
        return;
      }

      setSubmitting(true);
      setError(null);

      try {
        const acctId = accountId.trim();
        if (acctId) {
          const verifyRes = await desktopVerifyCfToken(acctId, trimmed, "server").catch(() => null);
          if (verifyRes && !verifyRes.ok) {
            setError(
              verifyRes.message || "Cloudflare rejected the API token. Please verify permissions.",
            );
            return;
          }
        }

        await desktopPushServerToken(trimmed, {
          accountId: acctId || undefined,
          workerScriptName,
        });

        if (workerUrl) {
          const check = await desktopVerifyWorkerConnection(workerUrl);
          if (!check.cfApiTokenSet) {
            throw new Error(
              "Token was saved, but Worker has not loaded the secret yet. Please try again.",
            );
          }
        }

        try {
          sessionStorage.removeItem(PENDING_SERVER_TOKEN_PUSH_KEY);
        } catch {
          /* ignore */
        }

        setIsVerified(true);
        toast.success("Cloudflare Email API configured and verified!");
        onComplete();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to push API token to Worker.");
      } finally {
        setSubmitting(false);
      }
    },
    [accountId, onComplete, workerScriptName, workerUrl],
  );

  const retryPushAfterAuth = useCallback(() => {
    let pending = tokenRef.current.trim();
    if (!pending && typeof window !== "undefined") {
      try {
        pending = sessionStorage.getItem(PENDING_SERVER_TOKEN_PUSH_KEY)?.trim() ?? "";
      } catch {
        pending = "";
      }
    }
    if (pending) {
      setTokenInput(pending);
      void pushTokenToWorker(pending);
    }
  }, [pushTokenToWorker]);

  const authorizeThenPush = useCallback(async () => {
    const token = tokenRef.current.trim();
    if (token) {
      try {
        sessionStorage.setItem(PENDING_SERVER_TOKEN_PUSH_KEY, token);
      } catch {
        /* ignore */
      }
    }

    setOauthBusy(true);
    setError(null);

    try {
      const returnTo =
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : "/onboarding";
      const start = await desktopStartCfOAuth("install", returnTo);

      if (!isDesktopRuntime() && start.authorizeUrl.startsWith("/")) {
        openWebCfOAuthPopup(start.authorizeUrl, {
          onComplete: () => {
            setOauthBusy(false);
            toast.success("Cloudflare connected. Pushing API token to your Worker…");
            retryPushAfterAuth();
          },
          onError: (message) => {
            setOauthBusy(false);
            setError(explainCfOAuthError(message).detail || message);
          },
        });
        return;
      }

      await desktopOpenExternal(start.authorizeUrl);
    } catch (err) {
      setOauthBusy(false);
      setError(explainCfOAuthError(err).detail || "Could not start Cloudflare authorization.");
    }
  }, [retryPushAfterAuth]);

  useWebCfOAuthComplete(() => {
    setOauthBusy(false);
    toast.success("Cloudflare connected. Pushing API token to your Worker…");
    retryPushAfterAuth();
  });

  useEffect(() => {
    if (!isDesktopRuntime()) return;
    let unlisten: (() => void) | null = null;
    let active = true;

    listenCfOAuthResult({
      onComplete: () => {
        if (!active) return;
        setOauthBusy(false);
        toast.success("Cloudflare connected. Pushing API token to your Worker…");
        retryPushAfterAuth();
      },
      onError: (message) => {
        if (!active) return;
        setOauthBusy(false);
        setError(explainCfOAuthError(message).detail || message);
      },
    }).then((fn) => {
      if (active) unlisten = fn;
      else fn();
    });

    return () => {
      active = false;
      unlisten?.();
    };
  }, [retryPushAfterAuth]);

  async function handleSaveToken(e: React.FormEvent) {
    e.preventDefault();
    const parsed = validateCfApiTokenInput(tokenInput);
    if (!parsed.ok) {
      setError(parsed.message);
      return;
    }
    await pushTokenToWorker(parsed.token);
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
          Relaybase needs a Cloudflare API token (
          <span className="font-mono text-foreground font-medium">CF_API_TOKEN</span>) to configure
          Email Routing and DNS records automatically.{" "}
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto px-0 text-xs sm:text-sm"
            onClick={() => setDetailsOpen(true)}
          >
            Why is this needed?
          </Button>
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
              name="cloudflare-api-token"
              type="text"
              placeholder="Paste your Cloudflare API token here"
              value={tokenInput}
              onChange={(e) => {
                setTokenInput(e.target.value);
                setError(null);
              }}
              className="pl-9 font-mono text-xs sm:text-sm [-webkit-text-security:disc]"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-1p-ignore
              data-lpignore="true"
              data-form-type="other"
              autoFocus
            />
          </div>
          {error ? (
            <div
              className={
                showAuthAction
                  ? "space-y-2.5 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs sm:text-sm"
                  : "text-xs text-destructive"
              }
            >
              {showAuthAction ? (
                <>
                  <p className="font-medium text-destructive">
                    {isCloudflareAuthExpired(error)
                      ? "Cloudflare authorization expired"
                      : "Cloudflare authorization required"}
                  </p>
                  <p className="text-sm leading-relaxed text-foreground/90">
                    {isCloudflareAuthExpired(error)
                      ? "Relaybase is no longer connected to your Cloudflare account. Sign in again so we can push the API token to your Worker as CF_API_TOKEN."
                      : error}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1.5"
                    disabled={busy}
                    onClick={() => void authorizeThenPush()}
                  >
                    {oauthBusy ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <LogIn className="size-3.5" />
                    )}
                    Authorize with Cloudflare
                  </Button>
                </>
              ) : (
                error
              )}
            </div>
          ) : null}
        </div>

        <Button type="submit" disabled={busy || !tokenInput.trim()} className="w-full">
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
                <span className="font-semibold text-foreground">Zone Resources:</span>{" "}
                <span className="text-muted-foreground">Include — All zones</span>
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

      <CfApiTokenDetailsSheet open={detailsOpen} onOpenChange={setDetailsOpen} />
    </div>
  );
}
