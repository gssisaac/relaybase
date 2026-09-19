"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  AlertCircle,
  Check,
  Globe,
  Info,
  Loader2,
  Plus,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useDomain, type DomainAddJob, type DomainSummary } from "@/lib/dashboard/DomainContext";
import { listCloudflareZones } from "@/lib/dashboard/list-cf-zones";
import type { ZoneSummary } from "@/lib/desktop/bridge";
import { cn } from "@/lib/utils";
import { domainIsMailReady, isZoneNeedSetup } from "@/lib/domain/zone-setup";
import { DomainNeedSetupPopover } from "./DomainNeedSetupPopover";

type ConnectedDomainRow = {
  domain: string;
  summary: DomainSummary | null;
  pendingJob: DomainAddJob | null;
};

function isJobInFlight(job: DomainAddJob): boolean {
  return job.phase !== "done" && job.phase !== "failed";
}

function buildConnectedRows(
  domains: DomainSummary[],
  jobs: DomainAddJob[],
): ConnectedDomainRow[] {
  const byKey = new Map<string, ConnectedDomainRow>();
  for (const summary of domains) {
    byKey.set(summary.domain.toLowerCase(), {
      domain: summary.domain,
      summary,
      pendingJob: null,
    });
  }
  for (const job of jobs) {
    if (!isJobInFlight(job)) continue;
    const key = job.domain.toLowerCase();
    const existing = byKey.get(key);
    if (existing) {
      existing.pendingJob = job;
    } else {
      byKey.set(key, { domain: job.domain, summary: null, pendingJob: job });
    }
  }
  return [...byKey.values()].sort((a, b) =>
    a.domain.localeCompare(b.domain, undefined, { sensitivity: "base" }),
  );
}

export function Step2DomainCard({
  accountId,
  onComplete,
  onBack,
}: {
  accountId: string;
  onComplete: (domain: string) => void;
  onBack?: () => void;
}) {
  const domainStore = useDomain();
  const [zones, setZones] = useState<ZoneSummary[]>([]);
  const [loadingZones, setLoadingZones] = useState(false);
  const [customDomain, setCustomDomain] = useState("");
  const [selectedDomain, setSelectedDomain] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Find ready domains
  const readyDomains = useMemo(
    () => domainStore.domains.filter((d) => domainIsMailReady(d.onboarding)),
    [domainStore.domains],
  );

  const connectedRows = useMemo(
    () => buildConnectedRows(domainStore.domains, domainStore.addJobs),
    [domainStore.domains, domainStore.addJobs],
  );

  // Active domain for next step
  const currentActiveDomain = useMemo(() => {
    if (selectedDomain) return selectedDomain;
    if (readyDomains.length > 0) return readyDomains[0]?.domain;
    if (domainStore.domains.length > 0) return domainStore.domains[0]?.domain;
    return "";
  }, [selectedDomain, readyDomains, domainStore.domains]);

  const loadZones = useCallback(async () => {
    if (!accountId) return;
    setLoadingZones(true);
    setError(null);
    try {
      const list = await listCloudflareZones(accountId);
      const existingNames = new Set([
        ...domainStore.domains.map((d) => d.domain.toLowerCase()),
        ...domainStore.addJobs
          .filter(isJobInFlight)
          .map((j) => j.domain.toLowerCase()),
      ]);
      const available = list.filter((z) => !existingNames.has(z.name.toLowerCase()));
      setZones(available);
    } catch {
      // Zone listing through worker might fail if token had zone restrictions
      setZones([]);
    } finally {
      setLoadingZones(false);
    }
  }, [accountId, domainStore.domains, domainStore.addJobs]);

  useEffect(() => {
    void loadZones();
  }, [loadZones]);

  // Set default selected domain if a domain is ready
  useEffect(() => {
    if (readyDomains.length > 0 && !selectedDomain) {
      setSelectedDomain(readyDomains[0]!.domain);
    }
  }, [readyDomains, selectedDomain]);

  function handleAddDomain(domainToAdd: string) {
    const trimmed = domainToAdd.trim().toLowerCase();
    if (!trimmed) {
      setError("Please enter a domain name.");
      return;
    }
    const alreadyExists = domainStore.domains.some((d) => d.domain.toLowerCase() === trimmed);
    if (alreadyExists) {
      setSelectedDomain(trimmed);
      return;
    }

    setError(null);
    setSelectedDomain(trimmed);
    setCustomDomain("");
    setZones((prev) => prev.filter((z) => z.name.toLowerCase() !== trimmed));
    try {
      domainStore.queueAddDomain(trimmed, false);
      toast.info(`Connecting domain ${trimmed}…`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add domain.");
    }
  }

  function handleContinue() {
    if (!currentActiveDomain) {
      setError("Please add or select a domain first.");
      return;
    }
    onComplete(currentActiveDomain);
  }

  const hasReadyDomain = readyDomains.length > 0;

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h2 className="text-base font-semibold tracking-tight sm:text-lg">
          Step 2: Connect Email Domain
        </h2>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Select an existing domain from your Cloudflare account, or enter a custom domain/subdomain.
        </p>
      </div>

      {/* Existing / Connected Domains List */}
      {connectedRows.length > 0 && (
        <div className="space-y-2.5">
          <Label className="text-xs font-medium text-muted-foreground">Connected Domains</Label>
          <div className="space-y-2">
            {connectedRows.map((row) => {
              const d = row.summary;
              const onboarding = d?.onboarding ?? null;
              const hasPendingJob =
                row.pendingJob !== null && isJobInFlight(row.pendingJob);
              const isFailed = onboarding?.status === "failed";
              const needSetup = Boolean(onboarding && isZoneNeedSetup(onboarding));
              const isConnecting =
                hasPendingJob ||
                onboarding?.status === "running" ||
                (onboarding?.status === "waiting" && !needSetup);
              const isReady =
                !hasPendingJob &&
                !isConnecting &&
                !needSetup &&
                Boolean(d && domainIsMailReady(onboarding));
              const isSelected =
                (currentActiveDomain || "").toLowerCase() === row.domain.toLowerCase();

              return (
                <div
                  key={row.domain}
                  onClick={() => isReady && setSelectedDomain(row.domain)}
                  className={cn(
                    "flex items-center justify-between rounded-lg border p-3 transition-all",
                    isSelected ? "border-primary/60 bg-primary/5" : "bg-card/40",
                    isReady && "cursor-pointer hover:border-border",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Globe className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{row.domain}</p>
                      {isFailed && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-destructive">
                          <AlertCircle className="size-3 shrink-0" />
                          {onboarding?.lastError ?? "Onboarding failed. Check DNS records."}
                        </p>
                      )}
                      {needSetup && !isFailed ? (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          Update nameservers at your registrar to finish setup.
                        </p>
                      ) : null}
                      {isConnecting && !isFailed && !needSetup && onboarding?.currentStepLabel ? (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {onboarding.currentStepLabel}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="shrink-0 pl-2">
                    {isReady && !isConnecting ? (
                      <Badge
                        variant="outline"
                        className="gap-1 border-emerald-500/40 bg-emerald-500/10 text-xs text-emerald-600 dark:text-emerald-400"
                      >
                        <Check className="size-3" />
                        Ready
                      </Badge>
                    ) : needSetup && onboarding && !isFailed ? (
                      <DomainNeedSetupPopover
                        domain={row.domain}
                        accountId={accountId}
                        onboarding={onboarding}
                      >
                        <Badge
                          variant="outline"
                          className="cursor-pointer gap-1 border-sky-500/40 bg-sky-500/10 text-xs text-sky-800 dark:text-sky-300"
                        >
                          Need setup
                        </Badge>
                      </DomainNeedSetupPopover>
                    ) : isConnecting && !isFailed ? (
                      <Badge
                        variant="outline"
                        className="gap-1.5 border-amber-500/40 bg-amber-500/10 text-xs text-amber-700 dark:text-amber-300"
                      >
                        <Loader2 className="size-3 animate-spin" />
                        Connecting..
                      </Badge>
                    ) : isFailed ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          domainStore.queueRetryOnboarding(row.domain, false);
                          toast.info(`Retrying ${row.domain}…`);
                        }}
                        className="h-7 text-xs"
                      >
                        Retry
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cloudflare Auto-Detected Zones */}
      {zones.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-muted-foreground">
              Detected from Cloudflare ({zones.length})
            </Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void loadZones()}
              disabled={loadingZones}
              className="h-6 px-2 text-[11px] text-muted-foreground"
            >
              <RefreshCw className={cn("size-3 mr-1", loadingZones && "animate-spin")} />
              Refresh
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {zones.map((zone) => (
              <button
                key={zone.id}
                type="button"
                onClick={() => handleAddDomain(zone.name)}
                className="flex items-center justify-between rounded-lg border bg-card/40 p-3 text-left transition-all hover:border-primary/50 hover:bg-muted/30 focus:outline-none"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{zone.name}</p>
                  <p className="text-[11px] text-muted-foreground capitalize">{zone.status} on Cloudflare</p>
                </div>
                <Plus className="size-4 text-muted-foreground shrink-0 ml-2" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Custom Domain / Subdomain Input */}
      <div className="space-y-3">
        <Label htmlFor="custom-domain-input" className="text-xs font-medium text-muted-foreground">
          Add Custom Domain or Subdomain
        </Label>
        <div className="flex gap-2">
          <Input
            id="custom-domain-input"
            placeholder="e.g. mail.acme.com or acmecorp.com"
            value={customDomain}
            onChange={(e) => {
              setCustomDomain(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddDomain(customDomain);
              }
            }}
            className="text-xs sm:text-sm"
            autoComplete="off"
            spellCheck={false}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => handleAddDomain(customDomain)}
            disabled={!customDomain.trim()}
            className="shrink-0"
          >
            Add Domain
          </Button>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        {/* Subdomain recommendation note */}
        <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
          <Info className="size-4 text-foreground/70 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p>
              <strong>Using Google Workspace or Microsoft 365?</strong> Cloudflare Email Routing cannot share root MX records with external mail servers. Use a dedicated subdomain like <span className="font-mono text-foreground font-medium">mail.yourdomain.com</span> or <span className="font-mono text-foreground font-medium">relay.yourdomain.com</span>.
            </p>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-2">
        {onBack ? (
          <Button type="button" variant="ghost" size="sm" onClick={onBack}>
            Back
          </Button>
        ) : <div />}

        <Button
          type="button"
          onClick={handleContinue}
          disabled={!hasReadyDomain}
          className="gap-2"
        >
          Continue to Account Setup
        </Button>
      </div>
    </div>
  );
}
