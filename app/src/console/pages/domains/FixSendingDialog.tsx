"use client";

import { useEffect, useState } from "react";

import {
  desktopAwareFetch,
  readResponseJson,
} from "@/lib/desktop/api";
import { formatWorkerApiError } from "@/lib/dashboard/worker-api-error";
import { type SendingHealthDomain } from "@/lib/dashboard/sending-health";
import { useSendingHealth } from "@/lib/dashboard/SendingHealthContext";
import { connectedCfAccountId, cloudflareDomainsOverviewUrl, cloudflareEmailSendingUrl } from "@/lib/desktop/bridge";
import { useOptionalDesktop } from "@/lib/desktop/shell";
import {
  CF_PLAN_DIALOG_MESSAGE,
  CF_WORKERS_PAID_REQUIRED_CODE,
  isCloudflarePlanError,
} from "@/lib/cloudflare/plan-required";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type SendingDnsConflict = {
  id: string;
  type: string;
  name: string;
  content: string;
  priority: number | null;
};

type DialogStepId = "zone" | "onboard" | "recheck";
type DialogStepStatus = "pending" | "running" | "succeeded" | "failed";

type DialogStep = {
  id: DialogStepId;
  label: string;
  status: DialogStepStatus;
};

const INITIAL_STEPS: DialogStep[] = [
  { id: "zone", label: "Find zone", status: "pending" },
  { id: "onboard", label: "Onboard Email Sending", status: "pending" },
  { id: "recheck", label: "Recheck sending", status: "pending" },
];

const PLAN_STEPS = [
  "Open Email Sending",
  "Upgrade to Workers Paid on Cloudflare",
  "Recheck sending",
] as const;

function markSteps(
  current: DialogStepId,
  status: DialogStepStatus,
): DialogStep[] {
  const order: DialogStepId[] = ["zone", "onboard", "recheck"];
  const at = order.indexOf(current);
  return INITIAL_STEPS.map((step, index) => {
    if (index < at) return { ...step, status: "succeeded" };
    if (index === at) return { ...step, status };
    return { ...step, status: "pending" };
  });
}

async function postSendingOnboard(
  domain: string,
  confirmReplace: boolean,
  accountId?: string,
): Promise<
  | { kind: "ok"; domain: SendingHealthDomain }
  | { kind: "needs_confirm"; records: SendingDnsConflict[]; error: string }
  | { kind: "no_zone"; error: string }
  | { kind: "plan_required"; error: string }
  | { kind: "unavailable"; error: string; cloudflareSendingUrl: string | null }
> {
  const res = await desktopAwareFetch("/api/email/sending-onboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domain, confirmReplace, accountId }),
  });
  const data = await readResponseJson<{
    domain?: SendingHealthDomain;
    records?: SendingDnsConflict[];
    error?: string;
    code?: string;
    cloudflareSendingUrl?: string | null;
  }>(res);
  if (res.status === 409) {
    return {
      kind: "needs_confirm",
      records: data.records ?? [],
      error: data.error ?? "Confirm replacing DNS records to continue.",
    };
  }
  if (res.status === 400 && data.code === "no_zone") {
    return { kind: "no_zone", error: data.error ?? "This domain is not a zone." };
  }
  if (
    data.code === CF_WORKERS_PAID_REQUIRED_CODE ||
    isCloudflarePlanError({ error: data.error, code: data.code }) ||
    isCloudflarePlanError(data.error)
  ) {
    return {
      kind: "plan_required",
      error:
        data.code === CF_WORKERS_PAID_REQUIRED_CODE && data.error
          ? data.error
          : CF_PLAN_DIALOG_MESSAGE,
    };
  }
  if (data.code === "unavailable" || res.status === 502) {
    if (isCloudflarePlanError(data.error)) {
      return { kind: "plan_required", error: CF_PLAN_DIALOG_MESSAGE };
    }
    return {
      kind: "unavailable",
      error:
        data.error ??
        formatWorkerApiError(res.status, data.error, "Sending onboard"),
      cloudflareSendingUrl: data.cloudflareSendingUrl ?? null,
    };
  }
  if (!res.ok || !data.domain) {
    const formatted = formatWorkerApiError(
      res.status,
      data.error,
      "Sending onboard",
    );
    if (isCloudflarePlanError(formatted) || isCloudflarePlanError(data.error)) {
      return { kind: "plan_required", error: CF_PLAN_DIALOG_MESSAGE };
    }
    throw new Error(formatted);
  }
  return { kind: "ok", domain: data.domain };
}

export function FixSendingDialog({
  open,
  domain,
  entry,
  onOpenChange,
  onImportZones,
  onFixed,
}: {
  open: boolean;
  domain: string | null;
  entry: SendingHealthDomain | null;
  onOpenChange: (open: boolean) => void;
  onImportZones: () => void;
  onFixed: () => void;
}) {
  const sendingHealth = useSendingHealth();
  const desktop = useOptionalDesktop();
  const connectedAccountId = connectedCfAccountId(desktop?.credentials);
  const emailSendingUrl = cloudflareEmailSendingUrl(connectedAccountId);
  const domainsOverviewUrl = cloudflareDomainsOverviewUrl(connectedAccountId);
  const [steps, setSteps] = useState<DialogStep[]>(INITIAL_STEPS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<SendingDnsConflict[]>([]);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [planFromOnboard, setPlanFromOnboard] = useState(false);

  const live = domain ? sendingHealth.statusForDomain(domain) ?? entry : entry;
  const isNoZone = live?.status === "no_zone";
  const isPlanRequired =
    !isNoZone &&
    (planFromOnboard ||
      live?.code === CF_WORKERS_PAID_REQUIRED_CODE ||
      isCloudflarePlanError({ error: live?.error ?? undefined, code: live?.code ?? undefined }));

  useEffect(() => {
    if (!open) return;
    setSteps(INITIAL_STEPS);
    setBusy(false);
    setError(null);
    setRecords([]);
    setPlanFromOnboard(false);
    setFallbackUrl(live?.cloudflareSendingUrl ?? null);
  }, [open, domain, live?.cloudflareSendingUrl]);

  useEffect(() => {
    if (!open || live?.status !== "ready") return;
    onFixed();
  }, [live?.status, onFixed, open]);

  async function runOnboard(confirmReplace: boolean) {
    if (!domain) return;
    setBusy(true);
    setError(null);
    setSteps(markSteps("zone", "running"));
    try {
      setSteps(markSteps("onboard", "running"));
      const result = await postSendingOnboard(
        domain,
        confirmReplace,
        connectedAccountId,
      );
      if (result.kind === "needs_confirm") {
        setRecords(result.records);
        setError(result.error);
        setSteps(markSteps("onboard", "pending"));
        return;
      }
      if (result.kind === "no_zone") {
        setError(result.error);
        setSteps(markSteps("zone", "failed"));
        return;
      }
      if (result.kind === "plan_required") {
        setPlanFromOnboard(true);
        setRecords([]);
        setError(null);
        setSteps(INITIAL_STEPS);
        return;
      }
      if (result.kind === "unavailable") {
        if (isCloudflarePlanError(result.error)) {
          setPlanFromOnboard(true);
          setError(null);
          setSteps(INITIAL_STEPS);
          return;
        }
        setFallbackUrl(result.cloudflareSendingUrl);
        setError(result.error);
        setSteps(markSteps("onboard", "failed"));
        return;
      }
      if (
        result.domain.code === CF_WORKERS_PAID_REQUIRED_CODE ||
        isCloudflarePlanError({
          error: result.domain.error ?? undefined,
          code: result.domain.code ?? undefined,
        })
      ) {
        setPlanFromOnboard(true);
        setRecords([]);
        setError(null);
        setSteps(INITIAL_STEPS);
        return;
      }
      setRecords([]);
      setSteps(markSteps("recheck", "running"));
      sendingHealth.refresh();
      if (result.domain.status === "ready") {
        setSteps(markSteps("recheck", "succeeded"));
        onFixed();
        return;
      }
      setSteps(markSteps("recheck", "succeeded"));
      setError(
        result.domain.error ??
          "Cloudflare accepted onboard. Recheck in a few minutes if Sending is still Restricted.",
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Sending onboard failed";
      if (isCloudflarePlanError(message)) {
        setPlanFromOnboard(true);
        setError(null);
        setSteps(INITIAL_STEPS);
      } else {
        setError(message);
        setSteps(markSteps("onboard", "failed"));
      }
    } finally {
      setBusy(false);
    }
  }

  function handleRecheck() {
    void sendingHealth.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(40rem,calc(100vh-2rem))] w-full max-w-[calc(100%-2rem)] flex-col overflow-hidden sm:max-w-lg"
        showCloseButton={!busy}
      >
        <DialogHeader className="min-w-0 shrink-0">
          <DialogTitle>Fix sending</DialogTitle>
          <DialogDescription className="text-left break-words">
            {domain ? (
              <>
                <span className="font-mono text-foreground">{domain}</span>
                {isNoZone
                  ? " is not a zone on this Cloudflare account."
                  : isPlanRequired
                    ? ` — ${CF_PLAN_DIALOG_MESSAGE}`
                    : " is restricted: Cloudflare only delivers to verified destination addresses until Email Sending is onboarded. Other Relaybase mailboxes do not count."}
              </>
            ) : (
              "Choose a domain to fix."
            )}
          </DialogDescription>
        </DialogHeader>

        {isNoZone ? (
          <div className="min-h-0 min-w-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden text-sm">
            <p className="break-words text-muted-foreground">
              Add the site in Cloudflare first, then refresh zones here. Sending
              cannot be onboarded until the zone exists on this account.
            </p>
            {error ? (
              <p className="break-words whitespace-pre-wrap text-destructive">
                {error}
              </p>
            ) : null}
          </div>
        ) : isPlanRequired ? (
          <div className="min-h-0 min-w-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden">
            <ol className="space-y-1.5">
              {PLAN_STEPS.map((label, index) => (
                <li
                  key={label}
                  className="flex items-start gap-2 text-xs text-foreground"
                >
                  <span className="mt-0.5 w-4 shrink-0 text-muted-foreground">
                    {index + 1}.
                  </span>
                  <span>{label}</span>
                </li>
              ))}
            </ol>
            <p className="break-words text-sm text-muted-foreground">
              Cloudflare Email Sending is not available on the Workers Free
              plan. Upgrade, then recheck — domain onboard may still be needed
              afterward.
            </p>
            {error ? (
              <p className="min-w-0 break-words whitespace-pre-wrap text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="min-h-0 min-w-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden">
            <ol className="space-y-1.5">
              {steps.map((step, index) => (
                <li
                  key={step.id}
                  className={cn(
                    "flex items-start gap-2 text-xs",
                    step.status === "failed"
                      ? "text-destructive"
                      : step.status === "pending"
                        ? "text-muted-foreground"
                        : "text-foreground",
                  )}
                >
                  <span className="mt-0.5 w-4 shrink-0 text-muted-foreground">
                    {index + 1}.
                  </span>
                  <span>
                    {step.label}
                    {step.status === "running"
                      ? " — working…"
                      : step.status === "succeeded"
                        ? " — done"
                        : step.status === "failed"
                          ? " — failed"
                          : ""}
                  </span>
                </li>
              ))}
            </ol>
            {records.length ? (
              <div className="max-h-40 space-y-1.5 overflow-x-hidden overflow-y-auto rounded-md border p-3">
                <p className="text-xs font-medium text-destructive">
                  These records will be deleted and replaced
                </p>
                <ul className="space-y-1.5 font-mono text-xs">
                  {records.map((record) => (
                    <li key={record.id} className="min-w-0 break-all">
                      {record.type} {record.name} → {record.content}
                      {record.priority != null
                        ? ` (priority ${record.priority})`
                        : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {error ? (
              <p className="min-w-0 break-words whitespace-pre-wrap text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>
        )}

        <DialogFooter className="min-w-0 shrink-0 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          {isNoZone ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                render={
                  <a href={domainsOverviewUrl} target="_blank" rel="noreferrer" />
                }
                nativeButton={false}
              >
                Open Cloudflare
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onImportZones}
              >
                Import zones
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={sendingHealth.refreshing}
                onClick={handleRecheck}
              >
                {sendingHealth.refreshing ? "Checking…" : "Recheck"}
              </Button>
            </>
          ) : isPlanRequired ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={sendingHealth.refreshing}
                onClick={handleRecheck}
              >
                {sendingHealth.refreshing ? "Checking…" : "Recheck"}
              </Button>
              <Button
                type="button"
                size="sm"
                nativeButton={false}
                render={
                  <a
                    href={emailSendingUrl}
                    target="_blank"
                    rel="noreferrer"
                  />
                }
              >
                Open Cloudflare Email Sending
              </Button>
            </>
          ) : records.length ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={busy}
              onClick={() => void runOnboard(true)}
            >
              {busy ? "Replacing…" : "Replace records & continue"}
            </Button>
          ) : (
            <>
              {fallbackUrl ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={
                    <a href={fallbackUrl} target="_blank" rel="noreferrer" />
                  }
                >
                  Open Cloudflare
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={sendingHealth.refreshing}
                onClick={handleRecheck}
              >
                Recheck
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={busy || !domain}
                onClick={() => void runOnboard(false)}
              >
                {busy ? "Fixing…" : "Start fix"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
