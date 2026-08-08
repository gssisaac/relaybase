"use client";

import {
  Check,
  ChevronDown,
  ChevronRight,
  Globe,
  Plus,
  RefreshCw,
  RotateCcw,
  Star,
  Trash2,
} from "lucide-react";
import { Fragment, useState } from "react";

import {
  DEFAULT_ADDRESS_LOCAL_PARTS,
  needsDomainConnect,
  useDomain,
  type DomainOnboardingSummary,
} from "@/lib/dashboard/DomainContext";
import { ConnectDomainDialog } from "@/relaybase-email/components/ConnectDomainDialog";
import { ImportCloudflareZonesDialog } from "@/relaybase-email/components/ImportCloudflareZonesDialog";
import { EmailAlerts } from "@/relaybase-email/components/EmailShared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldCheck } from "@/components/ui/field-check";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

function onboardingBadgeVariant(
  onboarding: DomainOnboardingSummary | null,
): "default" | "secondary" | "destructive" | "outline" {
  if (needsDomainConnect(onboarding)) return "outline";
  switch (onboarding?.status) {
    case "ready":
      return "default";
    case "failed":
      return "destructive";
    case "waiting":
      return "outline";
    case "running":
      return "secondary";
    default:
      return "outline";
  }
}

function onboardingLabel(onboarding: DomainOnboardingSummary | null): string {
  if (!onboarding) return "Not started";
  if (needsDomainConnect(onboarding)) return "Connect domain";
  switch (onboarding.status) {
    case "ready":
      return "Ready";
    case "running":
      return onboarding.currentStepLabel
        ? `Running · ${onboarding.currentStepLabel}`
        : "Running";
    case "waiting":
      return "Waiting for DNS";
    case "failed":
      return "Failed";
    default:
      return "Idle";
  }
}

function stepStatusClass(status: string): string {
  switch (status) {
    case "succeeded":
      return "text-foreground";
    case "running":
      return "text-foreground";
    case "waiting":
      return "text-amber-700 dark:text-amber-400";
    case "failed":
      return "text-destructive";
    default:
      return "text-muted-foreground";
  }
}

const DEFAULT_ADDRESS_PREVIEW = DEFAULT_ADDRESS_LOCAL_PARTS.map(
  (part) => `${part}@`,
).join(", ");

export function DomainsView() {
  const store = useDomain();
  const {
    domains,
    activeDomain,
    loading,
    error,
    refresh,
    setActiveDomain,
    removeDomain,
    queueAddDomain,
    queueStartOnboarding,
    queueRetryOnboarding,
  } = store;

  const [addOpen, setAddOpen] = useState(false);
  const [domainInput, setDomainInput] = useState("");
  const [seedDefaults, setSeedDefaults] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [workingDomain, setWorkingDomain] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [connectDomain, setConnectDomain] = useState<string | null>(null);

  // The progress banner can request the guide open for a domain (e.g. after
  // navigating here from another page); the store request takes priority
  // over any locally-closed dialog until it's explicitly dismissed.
  const activeConnectDomain = connectDomain ?? store.zoneGuideRequest;

  function closeConnectDomain() {
    setConnectDomain(null);
    store.clearZoneGuideRequest();
  }

  function resetAddForm() {
    setDomainInput("");
    setSeedDefaults(true);
  }

  function handleAdd() {
    if (!domainInput.trim()) return;
    setLocalError(null);
    setMessage(null);

    const normalized = domainInput.trim().toLowerCase();
    queueAddDomain(domainInput, seedDefaults);
    resetAddForm();
    setAddOpen(false);
    setExpanded((prev) => ({
      ...prev,
      [normalized]: true,
    }));
    setMessage(
      seedDefaults
        ? `Adding ${normalized} in the background. Standard addresses will be created when onboarding finishes.`
        : `Adding ${normalized} in the background.`,
    );
  }

  async function handleSetActive(domain: string) {
    setWorkingDomain(domain);
    setLocalError(null);
    setMessage(null);
    try {
      await setActiveDomain(domain);
      setMessage(`${domain} is now your active domain`);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to update domain");
    } finally {
      setWorkingDomain(null);
    }
  }

  async function handleRemove(domain: string) {
    if (
      !window.confirm(
        `Remove ${domain}? Addresses, audience, broadcasts, and sent mail for this domain will be deleted.`,
      )
    ) {
      return;
    }
    setWorkingDomain(domain);
    setLocalError(null);
    setMessage(null);
    try {
      await removeDomain(domain);
      setMessage(`Removed ${domain}`);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to remove domain");
    } finally {
      setWorkingDomain(null);
    }
  }

  function handleStart(domain: string) {
    setLocalError(null);
    setMessage(null);
    queueStartOnboarding(domain);
    setExpanded((prev) => ({ ...prev, [domain]: true }));
    setMessage(`Starting onboarding for ${domain} in the background.`);
  }

  function handleRetry(domain: string) {
    setLocalError(null);
    setMessage(null);
    queueRetryOnboarding(domain);
    setExpanded((prev) => ({ ...prev, [domain]: true }));
    setMessage(`Retrying onboarding for ${domain} in the background.`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Domains</h1>
          <p className="text-sm text-muted-foreground">
            Domains on your Cloudflare account. Import zones from CF or add a
            hostname that already lives on your zones — we never take nameserver
            control.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ImportCloudflareZonesDialog />
          <Dialog
            open={addOpen}
            onOpenChange={(open) => {
              setAddOpen(open);
              if (!open) resetAddForm();
            }}
          >
            <DialogTrigger render={<Button size="sm" />}>
              <Plus className="size-4" />
              Add domain
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add domain</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Domain must already be a zone on <strong>your</strong>{" "}
                  Cloudflare account. Prefer &quot;Import from Cloudflare&quot;
                  when using the Mac app.
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="new-domain">Domain</Label>
                  <Input
                    id="new-domain"
                    value={domainInput}
                    onChange={(e) => setDomainInput(e.target.value)}
                    placeholder="example.com"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAdd();
                      }
                    }}
                  />
                </div>
                <FieldCheck
                  id="seed-default-addresses"
                  checked={seedDefaults}
                  onCheckedChange={setSeedDefaults}
                  label="Add standard addresses"
                  description={`${DEFAULT_ADDRESS_PREVIEW} — all six at once when onboarding finishes.`}
                />
                <Button
                  className="w-full"
                  size="sm"
                  disabled={!domainInput.trim()}
                  onClick={handleAdd}
                >
                  Add domain
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refresh()}
            disabled={loading}
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      <EmailAlerts error={error ?? localError} message={message} />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Your domains</CardTitle>
          <CardDescription>
            {activeDomain ? (
              <>
                Active: <span className="font-mono">{activeDomain}</span>
              </>
            ) : (
              "No active domain selected"
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {domains.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead>Onboarding</TableHead>
                  <TableHead>Senders</TableHead>
                  <TableHead>Audience</TableHead>
                  <TableHead>Inbound R2</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {domains.map((entry) => {
                  const onboarding = entry.onboarding;
                  const awaitingConnect = needsDomainConnect(onboarding);
                  const isExpanded =
                    !awaitingConnect &&
                    (Boolean(expanded[entry.domain]) ||
                      store.zoneGuideRequest === entry.domain);
                  const isHardFailed =
                    onboarding?.status === "failed" && !awaitingConnect;
                  return (
                    <Fragment key={entry.domain}>
                      <TableRow>
                        <TableCell className="font-mono text-sm">
                          <div className="flex items-center gap-2">
                            {awaitingConnect ? (
                              <span className="inline-flex h-7 w-7 shrink-0" />
                            ) : (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() =>
                                  setExpanded((prev) => ({
                                    ...prev,
                                    [entry.domain]: !prev[entry.domain],
                                  }))
                                }
                                aria-label={
                                  isExpanded
                                    ? "Collapse onboarding steps"
                                    : "Expand onboarding steps"
                                }
                              >
                                {isExpanded ? (
                                  <ChevronDown className="size-3.5" />
                                ) : (
                                  <ChevronRight className="size-3.5" />
                                )}
                              </Button>
                            )}
                            <Globe className="size-3.5 text-muted-foreground" />
                            {entry.domain}
                            {entry.active ? (
                              <Badge variant="default" className="text-[10px]">
                                Active
                              </Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={onboardingBadgeVariant(onboarding)}
                            className="text-[10px]"
                          >
                            {onboardingLabel(onboarding)}
                          </Badge>
                          {isHardFailed && onboarding?.lastError ? (
                            <p className="mt-1 max-w-[220px] text-[10px] text-destructive">
                              {onboarding.lastError}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell>{entry.addressCount}</TableCell>
                        <TableCell>{entry.audienceCount}</TableCell>
                        <TableCell>
                          {entry.r2Provisioned ? (
                            <div className="space-y-1">
                              <Badge
                                variant={
                                  entry.r2WorkerReady ? "default" : "secondary"
                                }
                                className="text-[10px]"
                              >
                                {entry.r2WorkerReady
                                  ? "R2 ready"
                                  : "R2 provisioned"}
                              </Badge>
                              {entry.r2BucketName ? (
                                <p className="font-mono text-[10px] text-muted-foreground">
                                  {entry.r2BucketName}
                                </p>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Not provisioned
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            {awaitingConnect ? (
                              <Button
                                size="sm"
                                onClick={() => setConnectDomain(entry.domain)}
                              >
                                <Globe className="mr-1 size-3.5" />
                                Connect domain
                              </Button>
                            ) : null}
                            {!onboarding && !awaitingConnect ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={store.addJobs.some(
                                  (j) =>
                                    j.domain === entry.domain &&
                                    j.phase !== "done" &&
                                    j.phase !== "failed",
                                )}
                                onClick={() => handleStart(entry.domain)}
                              >
                                Start onboarding
                              </Button>
                            ) : null}
                            {isHardFailed ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={store.addJobs.some(
                                  (j) =>
                                    j.domain === entry.domain &&
                                    j.phase !== "done" &&
                                    j.phase !== "failed",
                                )}
                                onClick={() => handleRetry(entry.domain)}
                              >
                                <RotateCcw className="mr-1 size-3.5" />
                                Retry
                              </Button>
                            ) : null}
                            {onboarding &&
                            onboarding.zoneId &&
                            onboarding.status !== "ready" &&
                            !awaitingConnect &&
                            !isHardFailed ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setConnectDomain(entry.domain)}
                              >
                                Nameservers
                              </Button>
                            ) : null}
                            {!entry.active ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={workingDomain === entry.domain}
                                onClick={() => void handleSetActive(entry.domain)}
                              >
                                <Star className="mr-1 size-3.5" />
                                Set active
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" disabled>
                                <Check className="mr-1 size-3.5" />
                                Active
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={workingDomain === entry.domain}
                              onClick={() => void handleRemove(entry.domain)}
                            >
                              <Trash2 className="mr-1 size-3.5" />
                              Remove
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded ? (
                        <TableRow>
                          <TableCell colSpan={6} className="bg-muted/30">
                            <div className="space-y-2 py-1">
                              <p className="text-xs font-medium">
                                Onboarding steps
                              </p>
                              {onboarding?.steps?.length ? (
                                <ol className="space-y-1.5">
                                  {onboarding.steps.map((step, index) => (
                                    <li
                                      key={step.id}
                                      className={cn(
                                        "flex items-start gap-2 text-xs",
                                        stepStatusClass(step.status),
                                      )}
                                    >
                                      <span className="mt-0.5 w-4 shrink-0 text-muted-foreground">
                                        {index + 1}.
                                      </span>
                                      <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span>{step.label}</span>
                                          <Badge
                                            variant="outline"
                                            className="text-[10px] capitalize"
                                          >
                                            {step.status}
                                          </Badge>
                                        </div>
                                        {step.error ? (
                                          <p className="mt-0.5 text-[10px] text-destructive">
                                            {step.error}
                                          </p>
                                        ) : null}
                                      </div>
                                    </li>
                                  ))}
                                </ol>
                              ) : (
                                <p className="text-xs text-muted-foreground">
                                  Onboarding has not started for this domain.
                                </p>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          ) : !loading ? (
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">
                No domains yet. Add one to get started.
              </p>
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="mr-1.5 size-3.5" />
                Add domain
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading domains…</p>
          )}
        </CardContent>
      </Card>

      <ConnectDomainDialog
        domain={activeConnectDomain ?? ""}
        open={Boolean(activeConnectDomain)}
        onOpenChange={(open) => {
          if (!open) closeConnectDomain();
        }}
      />
    </div>
  );
}
