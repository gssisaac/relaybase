"use client";

import { Check, Copy, Loader2, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

import {
  useDomain,
  type ZoneConnectionStatus,
} from "@/lib/dashboard/DomainContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const COPY_ALL_KEY = "__all__";

/** Robust clipboard write with a fallback for contexts where the async Clipboard API is unavailable. */
async function copyToClipboard(value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
    return;
  } catch {
    // Fall through to legacy fallback below.
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}

function StepMarker({ index, done }: { index: number; done: boolean }) {
  return (
    <span
      className={cn(
        "mt-0.5 flex size-4 shrink-0 items-center justify-center text-[10px] font-medium",
        done ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground",
      )}
    >
      {done ? <Check className="size-3.5" /> : `${index}.`}
    </span>
  );
}

export function ConnectDomainDialog({
  domain,
  open,
  onOpenChange,
}: {
  domain: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const store = useDomain();
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [zoneStatus, setZoneStatus] = useState<ZoneConnectionStatus | null>(
    null,
  );
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !domain) return;
    void handleCheckStatus();
    // Re-check whenever a different domain's guide is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, domain]);

  async function handleCheckStatus() {
    if (!domain) return;
    setChecking(true);
    setCheckError(null);
    setZoneStatus(null);
    try {
      const result = await store.checkZoneStatus(domain);
      setZoneStatus(result);
    } catch (err) {
      setCheckError(
        err instanceof Error ? err.message : "Failed to check domain status",
      );
    } finally {
      setChecking(false);
    }
  }

  function handleCopy(key: string, value: string) {
    void copyToClipboard(value);
    setCopied(key);
    window.setTimeout(() => {
      setCopied((prev) => (prev === key ? null : prev));
    }, 2000);
  }

  function handleContinue() {
    queueMicrotask(() => {
      store.queueRetryOnboarding(domain);
    });
    onOpenChange(false);
  }

  const nameServers = zoneStatus?.nameServers ?? [];
  const hasNameServers = nameServers.length > 0;
  const siteReady = Boolean(zoneStatus?.found);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono">Connect {domain}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Point this domain at Relaybase Cloudflare nameservers, then
            continue setup.
          </p>

          <ol className="space-y-4">
            <li className="flex items-start gap-2">
              <StepMarker index={1} done={siteReady} />
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-sm font-medium">Wait for Cloudflare setup</p>
                <p className="text-xs text-muted-foreground">
                  Relaybase adds your domain as a Cloudflare site. You can copy
                  nameservers below while that finishes.
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void handleCheckStatus()}
                  disabled={checking}
                >
                  {checking ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : null}
                  Check status
                </Button>
                {checkError ? (
                  <p className="text-[11px] text-destructive">{checkError}</p>
                ) : zoneStatus && siteReady ? (
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                    Cloudflare site found
                    {zoneStatus.status ? ` · ${zoneStatus.status}` : ""}.
                  </p>
                ) : zoneStatus && !siteReady ? (
                  <p className="text-[11px] text-muted-foreground">
                    Site not added yet — nameservers below are ready to copy.
                  </p>
                ) : null}
              </div>
            </li>

            <li className="flex items-start gap-2">
              <StepMarker index={2} done={hasNameServers} />
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-sm font-medium">Copy nameservers</p>
                {hasNameServers ? (
                  <div className="space-y-1.5">
                    {nameServers.map((ns) => (
                      <div key={ns} className="flex items-center gap-1.5">
                        <Input
                          readOnly
                          value={ns}
                          onFocus={(e) => e.currentTarget.select()}
                          className="h-8 font-mono text-xs"
                          aria-label={`Cloudflare nameserver ${ns}`}
                        />
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="outline"
                          onClick={() => handleCopy(ns, ns)}
                          aria-label={`Copy ${ns}`}
                        >
                          {copied === ns ? (
                            <Check className="size-3.5" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        handleCopy(COPY_ALL_KEY, nameServers.join("\n"))
                      }
                    >
                      {copied === COPY_ALL_KEY ? (
                        <Check className="size-3.5" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                      {copied === COPY_ALL_KEY ? "Copied" : "Copy all"}
                    </Button>
                  </div>
                ) : checking ? (
                  <p className="text-xs text-muted-foreground">
                    Loading nameservers…
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Couldn&apos;t load nameservers — try Check status.
                  </p>
                )}
              </div>
            </li>

            <li className="flex items-start gap-2">
              <StepMarker index={3} done={false} />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-medium">Update at your registrar</p>
                <p className="text-xs text-muted-foreground">
                  Sign in where you registered the domain, then:
                </p>
                <ol className="list-decimal space-y-0.5 pl-4 text-xs text-muted-foreground">
                  <li>Find DNS / nameserver settings</li>
                  <li>Switch to custom nameservers</li>
                  <li>Paste the two Cloudflare nameservers above</li>
                  <li>Save — this can take a few minutes, up to 24 hours</li>
                </ol>
              </div>
            </li>
          </ol>

          <div className="flex items-center justify-end gap-2 border-t pt-3">
            <Button type="button" size="sm" onClick={handleContinue}>
              <RotateCcw className="size-3.5" />
              I&apos;ve updated nameservers
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
