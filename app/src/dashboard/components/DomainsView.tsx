"use client";

import {
  AlertCircle,
  Globe,
  Info,
  MoreHorizontal,
  RefreshCw,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useState } from "react";

import {
  useDomain,
  type DomainOnboardingSummary,
} from "@/lib/dashboard/DomainContext";
import { ImportCloudflareZonesDialog } from "@/dashboard/components/ImportCloudflareZonesDialog";
import { EmailAlerts } from "@/email/components/EmailShared";
import { useDesktopChrome } from "@/lib/desktop/use-desktop-chrome";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
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

function OnboardingInfoPopover({
  onboarding,
}: {
  onboarding: DomainOnboardingSummary | null;
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            aria-label="Onboarding details"
          />
        }
      >
        <Info className="size-3.5 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 max-w-[min(18rem,calc(100vw-2rem))]">
        <PopoverHeader>
          <PopoverTitle>Onboarding</PopoverTitle>
          <PopoverDescription className="break-words">
            {onboarding
              ? onboardingLabel(onboarding)
              : "Onboarding has not started for this domain."}
          </PopoverDescription>
        </PopoverHeader>
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
                <div className="min-w-0 break-words">
                  <div className="flex flex-wrap items-center gap-2">
                    <span>{step.label}</span>
                    <Badge
                      variant="outline"
                      className="text-[10px] capitalize"
                    >
                      {step.status}
                    </Badge>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function OnboardingErrorPopover({ message }: { message: string }) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
            aria-label="Show error"
          />
        }
      >
        <AlertCircle className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 max-w-[min(18rem,calc(100vw-2rem))]">
        <PopoverHeader>
          <PopoverTitle>Error</PopoverTitle>
          <PopoverDescription className="break-words text-destructive">
            {message}
          </PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  );
}

export function DomainsView() {
  const store = useDomain();
  const {
    domains,
    activeDomain,
    loading,
    error,
    refresh,
    removeDomain,
    queueStartOnboarding,
    queueRetryOnboarding,
  } = store;

  const [message, setMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [workingDomain, setWorkingDomain] = useState<string | null>(null);
  const [refreshOpen, setRefreshOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const { isDesktop: desktop } = useDesktopChrome();

  async function confirmRemove() {
    const domain = removeTarget;
    if (!domain) return;
    setWorkingDomain(domain);
    setLocalError(null);
    setMessage(null);
    try {
      await removeDomain(domain);
      setRemoveTarget(null);
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
  }

  function handleRetry(domain: string) {
    setLocalError(null);
    setMessage(null);
    queueRetryOnboarding(domain);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Domains</h1>
          <p className="text-sm text-muted-foreground">
            Domains from your Cloudflare account. Refresh to pull in new zones.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ImportCloudflareZonesDialog
            open={refreshOpen}
            onOpenChange={setRefreshOpen}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refresh()}
            disabled={loading}
            aria-label="Refresh domain list"
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      <EmailAlerts
        error={error ?? localError}
        message={message}
        onDismissError={() => {
          setLocalError(null);
          store.clearError();
        }}
        onDismissMessage={() => setMessage(null)}
      />

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
                  const isFailed = onboarding?.status === "failed";
                  const errorMessage = onboarding?.lastError ?? null;
                  return (
                    <TableRow key={entry.domain}>
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center gap-2">
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
                        <div className="flex items-center gap-1">
                          <Badge
                            variant={onboardingBadgeVariant(onboarding)}
                            className="text-[10px]"
                          >
                            {onboardingLabel(onboarding)}
                          </Badge>
                          <OnboardingInfoPopover onboarding={onboarding} />
                          {isFailed && errorMessage ? (
                            <OnboardingErrorPopover message={errorMessage} />
                          ) : null}
                        </div>
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
                          {!onboarding ? (
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
                          {isFailed ? (
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
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  disabled={workingDomain === entry.domain}
                                  aria-label={`More actions for ${entry.domain}`}
                                />
                              }
                            >
                              <MoreHorizontal className="size-3.5" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                variant="destructive"
                                disabled={workingDomain === entry.domain}
                                onClick={() => setRemoveTarget(entry.domain)}
                              >
                                <Trash2 className="size-3.5" />
                                Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : !loading ? (
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">
                {desktop
                  ? "No domains yet. Refresh from Cloudflare to pull in zones from your account."
                  : "No domains yet. Use the Mac app to refresh domains from your Cloudflare account."}
              </p>
              {desktop ? (
                <Button size="sm" onClick={() => setRefreshOpen(true)}>
                  <RefreshCw className="mr-1.5 size-3.5" />
                  Refresh from Cloudflare
                </Button>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading domains…</p>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => {
          if (!open && !workingDomain) setRemoveTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={!workingDomain}>
          <DialogHeader>
            <DialogTitle>Remove domain</DialogTitle>
            <DialogDescription>
              Remove{" "}
              <span className="font-mono text-foreground">{removeTarget}</span>?
              Addresses, audience, broadcasts, and sent mail for this domain will
              be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={Boolean(workingDomain)}
              onClick={() => setRemoveTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={Boolean(workingDomain)}
              onClick={() => void confirmRemove()}
            >
              {workingDomain ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
