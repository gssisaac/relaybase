"use client";

import {
  AlertCircle,
  ExternalLink,
  Globe,
  Info,
  MoreHorizontal,
  RefreshCw,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";

import {
  useDomain,
  type DomainOnboardingSummary,
} from "@/lib/dashboard/DomainContext";
import {
  GOOGLE_WORKSPACE_MIGRATION_DOC_URL,
  desktopOpenExternal,
} from "@/lib/desktop/bridge";
import { SendingWarningIcon } from "@/console/components/SendingWarningIcon";
import { useMailboxHealth, lastInboundForDomain } from "@/lib/dashboard/mailbox-health";
import { useSendingHealth } from "@/lib/dashboard/SendingHealthContext";
import {
  isSendingWarningStatus,
  sendingBadgeLabel,
} from "@/lib/dashboard/sending-health";
import { AddDomainDialog } from "@/console/pages/domains/AddDomainDialog";
import { FixSendingDialog } from "@/console/pages/domains/FixSendingDialog";
import { ImportCloudflareZonesDialog } from "@/console/pages/domains/ImportCloudflareZonesDialog";
import { SubdomainOnboardDialog } from "@/console/pages/domains/SubdomainOnboardDialog";
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

function domainBadgeClass(problem: boolean): string {
  return cn("text-[10px]", problem && "text-destructive");
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
  const [fixDomain, setFixDomain] = useState<string | null>(null);
  const [subdomainDomain, setSubdomainDomain] = useState<string | null>(null);
  const [subdomainParentZone, setSubdomainParentZone] = useState<string | null>(null);
  const { isDesktop: desktop } = useDesktopChrome();
  const mailboxHealth = useMailboxHealth();
  const sendingHealth = useSendingHealth();

  const activeMxConflictDomain = mxConflictDomain ?? store.mxConflictDomain;
  const isMxResolving = mxResolving || store.mxResolving;
  const mxConflictEntry = activeMxConflictDomain
    ? domains.find((d) => d.domain === activeMxConflictDomain)
    : null;
  const mxConflicts =
    mxConflictEntry?.onboarding?.mxConflicts &&
    mxConflictEntry.onboarding.mxConflicts.length > 0
      ? mxConflictEntry.onboarding.mxConflicts
      : store.mxConflicts;

  // Auto-open SubdomainOnboardDialog when the store detects a subdomain candidate.
  useEffect(() => {
    if (store.subdomainCandidateDomain && !subdomainDomain) {
      setSubdomainDomain(store.subdomainCandidateDomain);
      setSubdomainParentZone(store.subdomainCandidateParentZone);
      store.clearSubdomainCandidate();
    }
  }, [store.subdomainCandidateDomain, store.subdomainCandidateParentZone, subdomainDomain, store]);

  function handleUseSubdomainFromMxConflict() {
    const parentDomain = activeMxConflictDomain;
    if (!parentDomain) return;
    const suggested = `mail.${parentDomain}`;
    handleCloseMxConflict();
    setSubdomainDomain(suggested);
    setSubdomainParentZone(parentDomain);
  }

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

  function handleCloseMxConflict() {
    if (isMxResolving) return;
    setMxConflictDomain(null);
    store.clearMxConflict();
  }

  async function confirmResolveMxConflict() {
    const domain = activeMxConflictDomain;
    if (!domain) return;
    setMxResolving(true);
    setLocalError(null);
    setMessage(null);
    try {
      const result = await resolveMxConflict(domain);
      setMxConflictDomain(null);
      store.clearMxConflict();
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
              onClick={() => {
                void refresh();
                sendingHealth.refresh();
              }}
              disabled={loading || sendingHealth.refreshing}
              aria-label="Refresh domain list"
            >
              <RefreshCw
                className={cn(
                  "size-4",
                  (loading || sendingHealth.refreshing) && "animate-spin",
                )}
              />
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
        error={error ?? localError ?? sendingHealth.error}
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
                  <TableHead>Sending</TableHead>
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
                            variant="outline"
                            className={domainBadgeClass(
                              onboarding?.status === "failed",
                            )}
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
                      <TableCell>
                        {(() => {
                          const sending = sendingHealth.statusForDomain(
                            entry.domain,
                          );
                          if (!sending) {
                            return (
                              <span className="text-xs text-muted-foreground">
                                {sendingHealth.loading ? "Checking…" : "—"}
                              </span>
                            );
                          }
                          return (
                            <div className="flex flex-wrap items-center gap-1">
                              <Badge
                                variant="outline"
                                className={domainBadgeClass(
                                  isSendingWarningStatus(sending.status),
                                )}
                              >
                                {sendingBadgeLabel(sending.status)}
                              </Badge>
                              <SendingWarningIcon entry={sending} />
                              {isSendingWarningStatus(sending.status) ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-6 px-2 text-[11px]"
                                  onClick={() => setFixDomain(entry.domain)}
                                >
                                  Fix issue
                                </Button>
                              ) : null}
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell>{entry.addressCount}</TableCell>
                      <TableCell>{entry.audienceCount}</TableCell>
                      <TableCell>
                        {entry.r2Provisioned ? (
                          <div className="space-y-1">
                            <Badge
                              variant="outline"
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

      <FixSendingDialog
        open={Boolean(fixDomain)}
        domain={fixDomain}
        entry={
          fixDomain ? sendingHealth.statusForDomain(fixDomain) : null
        }
        onOpenChange={(open) => {
          if (!open) setFixDomain(null);
        }}
        onImportZones={() => {
          setFixDomain(null);
          setRefreshOpen(true);
        }}
        onSubdomainOnboard={(domain) => {
          setFixDomain(null);
          setSubdomainDomain(domain);
          setSubdomainParentZone(null);
        }}
        onFixed={() => {
          setFixDomain(null);
          sendingHealth.refresh();
        }}
      />

      <SubdomainOnboardDialog
        open={Boolean(subdomainDomain)}
        domain={subdomainDomain}
        parentZone={subdomainParentZone}
        onOpenChange={(open) => {
          if (!open) {
            setSubdomainDomain(null);
            setSubdomainParentZone(null);
          }
        }}
        onFixed={() => {
          void refresh();
          sendingHealth.refresh();
        }}
      />

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
        open={Boolean(activeMxConflictDomain)}
        onOpenChange={(open) => {
          if (!open && !isMxResolving) handleCloseMxConflict();
        }}
      >
        <DialogContent className="sm:max-w-lg" showCloseButton={!isMxResolving}>
          <DialogHeader>
            <DialogTitle>Conflicting MX records</DialogTitle>
            <DialogDescription className="text-left">
              <span className="font-mono text-foreground">
                {activeMxConflictDomain}
              </span>{" "}
              already has apex MX records for another mail provider (for example
              Google Workspace or Microsoft 365). Cloudflare Email Routing
              cannot share root domain MX records with another provider.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-border/80 bg-muted/40 p-3 space-y-2 text-xs">
            <div className="flex items-start gap-2">
              <Info className="size-4 shrink-0 text-brand mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-foreground">
                  Why can&apos;t Google Workspace and Cloudflare share a root domain?
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  DNS MX records route all inbound mail for a domain to a single provider. Sending mail servers cannot split traffic between Google Workspace and Cloudflare on the same root domain.
                </p>
              </div>
            </div>
            <div className="border-t border-border/60 pt-2 space-y-1.5">
              <p className="font-medium text-foreground">
                Want to keep Google Workspace active for personal inboxes?
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Add a <span className="font-medium text-foreground">subdomain</span> (such as <span className="font-mono text-foreground">mail.{activeMxConflictDomain}</span> or <span className="font-mono text-foreground">app.{activeMxConflictDomain}</span>) in Relaybase instead. This allows Google Workspace on the root domain and Relaybase on the subdomain to run side-by-side without paying for extra Google seats.
              </p>
              <button
                type="button"
                className="inline-flex items-center gap-1 font-medium text-brand hover:underline pt-0.5"
                onClick={() =>
                  void desktopOpenExternal(GOOGLE_WORKSPACE_MIGRATION_DOC_URL)
                }
              >
                Read the Google Workspace Coexistence & Migration Guide
                <ExternalLink className="size-3" />
              </button>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <p className="font-medium text-destructive">
              Deleting them will stop inbound mail delivery to the previous
              provider. Existing Google Workspace (or other) inboxes on this root
              domain will no longer receive mail.
            </p>
            <p className="text-xs text-muted-foreground">
              Sending DNS on{" "}
              <span className="font-mono">
                cf-bounce.{activeMxConflictDomain}
              </span>{" "}
              is not affected.
            </p>
          </div>

          {mxConflicts.length ? (
            <div className="max-h-36 space-y-1.5 overflow-y-auto rounded-md border p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Apex MX records to delete
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
            <p className="text-xs text-muted-foreground">
              No conflicting apex MX records are listed. Confirming will retry
              enabling Email Routing.
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isMxResolving}
              onClick={handleCloseMxConflict}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isMxResolving}
              onClick={handleUseSubdomainFromMxConflict}
            >
              Use subdomain instead
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isMxResolving}
              onClick={() => void confirmResolveMxConflict()}
            >
              {isMxResolving
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
