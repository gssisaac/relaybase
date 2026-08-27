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
import { useMailboxHealth, lastInboundForDomain } from "@/lib/dashboard/mailbox-health";
import { AddDomainDialog } from "@/console/pages/domains/AddDomainDialog";
import { ImportCloudflareZonesDialog } from "@/console/pages/domains/ImportCloudflareZonesDialog";
import { EmailAlerts } from "@/email/components/mailbox/EmailShared";
import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { useDesktopChrome } from "@/lib/desktop/shell";
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
  onTroubleshootMx,
}: {
  onboarding: DomainOnboardingSummary | null;
  onTroubleshootMx?: () => void;
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
            {onboarding.steps.map((step, index) => {
              const showMxTroubleshoot =
                step.id === "routing_enable" &&
                step.status === "failed" &&
                (step.errorCode === "MX_CONFLICT" ||
                  onboarding.lastErrorCode === "MX_CONFLICT") &&
                Boolean(onTroubleshootMx);

              return (
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
                  <div className="min-w-0 flex-1 break-words">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{step.label}</span>
                      <Badge
                        variant="outline"
                        className="text-[10px] capitalize"
                      >
                        {step.status}
                      </Badge>
                    </div>
                    {showMxTroubleshoot ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-1.5 h-7 text-[11px]"
                        onClick={onTroubleshootMx}
                      >
                        Troubleshooting
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
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
    loading,
    error,
    refresh,
    removeDomain,
    queueStartOnboarding,
    queueRetryOnboarding,
    resolveMxConflict,
  } = store;

  const [message, setMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [workingDomain, setWorkingDomain] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [refreshOpen, setRefreshOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [mxConflictDomain, setMxConflictDomain] = useState<string | null>(null);
  const [mxResolving, setMxResolving] = useState(false);
  const { isDesktop: desktop } = useDesktopChrome();
  const mailboxHealth = useMailboxHealth();

  const mxConflictEntry = mxConflictDomain
    ? domains.find((d) => d.domain === mxConflictDomain)
    : null;
  const mxConflicts = mxConflictEntry?.onboarding?.mxConflicts ?? [];

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

  async function confirmResolveMxConflict() {
    const domain = mxConflictDomain;
    if (!domain) return;
    setMxResolving(true);
    setLocalError(null);
    setMessage(null);
    try {
      const result = await resolveMxConflict(domain);
      setMxConflictDomain(null);
      setMessage(result.message);
    } catch (err) {
      setLocalError(
        err instanceof Error
          ? err.message
          : "Failed to remove conflicting MX records",
      );
    } finally {
      setMxResolving(false);
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
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <DesktopTitleBar
        className="px-4 py-3"
        end={
          <>
            <AddDomainDialog open={addOpen} onOpenChange={setAddOpen} />
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
          </>
        }
      >
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight">
            Domains
          </h1>
          <p className="text-sm text-muted-foreground">
            Domains from your Cloudflare account. Refresh to pull in new zones.
          </p>
        </div>
      </DesktopTitleBar>

      <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[1200px] space-y-4 p-4">
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
            Domains available for dashboard scoping via{" "}
            <span className="font-mono">?domain=</span>
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
                  <TableHead>Last inbound</TableHead>
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
                          <OnboardingInfoPopover
                            onboarding={onboarding}
                            onTroubleshootMx={
                              onboarding?.lastErrorCode === "MX_CONFLICT" ||
                              onboarding?.steps.some(
                                (s) =>
                                  s.id === "routing_enable" &&
                                  s.errorCode === "MX_CONFLICT",
                              )
                                ? () => setMxConflictDomain(entry.domain)
                                : undefined
                            }
                          />
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
                      <TableCell>
                        {(() => {
                          const last = lastInboundForDomain(
                            mailboxHealth.snapshot,
                            entry.domain,
                          );
                          return (
                            <div className="flex items-center gap-1.5">
                              {last.stale ? (
                                <AlertCircle className="size-3.5 text-amber-600 dark:text-amber-400" />
                              ) : null}
                              <span
                                className={cn(
                                  "text-xs",
                                  last.stale
                                    ? "text-amber-700 dark:text-amber-400"
                                    : "text-muted-foreground",
                                )}
                                title={last.at ?? undefined}
                              >
                                {mailboxHealth.loading && !mailboxHealth.snapshot
                                  ? "…"
                                  : last.label}
                              </span>
                            </div>
                          );
                        })()}
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
                  ? "No domains yet. Add a domain or refresh from Cloudflare to pull in zones from your account."
                  : "No domains yet. Add a domain managed on your Cloudflare account."}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={() => setAddOpen(true)}>
                  Add domain
                </Button>
                {desktop ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setRefreshOpen(true)}
                  >
                    <RefreshCw className="mr-1.5 size-3.5" />
                    Refresh from Cloudflare
                  </Button>
                ) : null}
              </div>
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

      <Dialog
        open={Boolean(mxConflictDomain)}
        onOpenChange={(open) => {
          if (!open && !mxResolving) setMxConflictDomain(null);
        }}
      >
        <DialogContent className="sm:max-w-lg" showCloseButton={!mxResolving}>
          <DialogHeader>
            <DialogTitle>Conflicting MX records</DialogTitle>
            <DialogDescription className="text-left">
              <span className="font-mono text-foreground">
                {mxConflictDomain}
              </span>{" "}
              already has apex MX records for another mail provider (for example
              Google Workspace). Cloudflare Email Routing cannot share those
              records.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p className="font-medium text-destructive">
              Deleting them will stop inbound mail delivery to the previous
              provider. Existing Workspace (or other) inboxes for this domain
              will no longer receive mail.
            </p>
            <p className="text-muted-foreground">
              Sending DNS on{" "}
              <span className="font-mono">cf-bounce.{mxConflictDomain}</span> is
              not affected.
            </p>
          </div>
          {mxConflicts.length ? (
            <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-md border p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Records to delete
              </p>
              <ul className="space-y-1.5 font-mono text-xs">
                {mxConflicts.map((mx) => (
                  <li key={mx.id} className="break-all">
                    MX {mx.name} → {mx.content}
                    {mx.priority != null ? ` (priority ${mx.priority})` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No conflicting apex MX records are listed. Confirming will retry
              enabling Email Routing.
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={mxResolving}
              onClick={() => setMxConflictDomain(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={mxResolving}
              onClick={() => void confirmResolveMxConflict()}
            >
              {mxResolving
                ? "Deleting & continuing…"
                : "Delete MX & enable Routing"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
      </div>
    </div>
  );
}
