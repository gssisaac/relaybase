"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";

import {
  desktopAwareFetch,
  readResponseJson,
} from "@/lib/desktop/api";
import { formatWorkerApiError } from "@/lib/dashboard/worker-api-error";
import {
  type SendingHealthDomain,
} from "@/lib/dashboard/sending-health";
import { useSendingHealth } from "@/lib/dashboard/SendingHealthContext";
import {
  connectedCfAccountId,
  cloudflareEmailRoutingUrl,
  cloudflareEmailSendingUrl,
  cfTokenPermissionChecks,
  parseCfApiTokenPermissions,
  type CfTokenPermissionCheck,
} from "@/lib/desktop/bridge";
import { useOptionalDesktop } from "@/lib/desktop/shell";
import { CfApiTokenPermissionRows } from "@/lib/desktop/shell";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type SubdomainDnsConflict = {
  id: string;
  type: string;
  name: string;
  content: string;
  priority: number | null;
};

type RoutingResult = {
  status: "ready" | "dkim_pending" | "dashboard_required";
  mxCreated: boolean;
  spfCreated: boolean;
  rulesCreated: boolean;
  dkimDashboardUrl: string | null;
  error: string | null;
};

type OnboardResponse = {
  domain?: SendingHealthDomain;
  parentZone?: string;
  zoneId?: string;
  sending?: SendingHealthDomain;
  routing?: RoutingResult;
  error?: string;
  code?: string;
  records?: SubdomainDnsConflict[];
  cloudflareSendingUrl?: string | null;
  cfApiTokenPermissions?: unknown;
};

type DialogPhase =
  | "input"
  | "onboarding"
  | "dashboard_required"
  | "verified"
  | "plan_required"
  | "error";

type DialogStepId = "zone" | "sending" | "routing" | "dkim";
type DialogStepStatus = "pending" | "running" | "succeeded" | "failed";

type DialogStep = {
  id: DialogStepId;
  label: string;
  status: DialogStepStatus;
};

const INITIAL_STEPS: DialogStep[] = [
  { id: "zone", label: "Find parent zone", status: "pending" },
  { id: "sending", label: "Onboard Email Sending", status: "pending" },
  { id: "routing", label: "Onboard Email Routing (MX + SPF)", status: "pending" },
  { id: "dkim", label: "DKIM setup (dashboard)", status: "pending" },
];

function markSteps(
  current: DialogStepId,
  status: DialogStepStatus,
): DialogStep[] {
  const order: DialogStepId[] = ["zone", "sending", "routing", "dkim"];
  const at = order.indexOf(current);
  return INITIAL_STEPS.map((step, index) => {
    if (index < at) return { ...step, status: "succeeded" };
    if (index === at) return { ...step, status };
    return { ...step, status: "pending" };
  });
}

async function postSubdomainOnboard(
  domain: string,
  confirmReplace: boolean,
  accountId?: string,
): Promise<
  | { kind: "ok"; domain: SendingHealthDomain; parentZone: string; routing: RoutingResult }
  | { kind: "needs_confirm"; records: SubdomainDnsConflict[]; error: string }
  | { kind: "no_parent_zone"; error: string }
  | { kind: "plan_required"; error: string }
  | { kind: "permission_error"; error: string; permissionChecks: CfTokenPermissionCheck[] }
  | { kind: "unavailable"; error: string; cloudflareSendingUrl: string | null }
> {
  const res = await desktopAwareFetch("/api/email/subdomain-onboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domain, confirmReplace, accountId }),
  });
  const data = await readResponseJson<OnboardResponse>(res);
  if (res.status === 409) {
    return {
      kind: "needs_confirm",
      records: data.records ?? [],
      error: data.error ?? "Confirm replacing DNS records to continue.",
    };
  }
  if (res.status === 400 && data.code === "no_parent_zone") {
    return { kind: "no_parent_zone", error: data.error ?? "Parent zone not found." };
  }
  if (
    data.code === CF_WORKERS_PAID_REQUIRED_CODE ||
    isCloudflarePlanError({ error: data.error, code: data.code })
  ) {
    return {
      kind: "plan_required",
      error:
        data.code === CF_WORKERS_PAID_REQUIRED_CODE && data.error
          ? data.error
          : CF_PLAN_DIALOG_MESSAGE,
    };
  }
  if (data.code === "permission_error") {
    const probe = parseCfApiTokenPermissions(data.cfApiTokenPermissions);
    return {
      kind: "permission_error",
      error: data.error ?? "Cloudflare API token lacks a required permission.",
      permissionChecks: cfTokenPermissionChecks(probe),
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
        formatWorkerApiError(res.status, data.error, "Subdomain onboard"),
      cloudflareSendingUrl: data.cloudflareSendingUrl ?? null,
    };
  }
  if (!res.ok || !data.sending) {
    const formatted = formatWorkerApiError(
      res.status,
      data.error,
      "Subdomain onboard",
    );
    if (isCloudflarePlanError(formatted) || isCloudflarePlanError(data.error)) {
      return { kind: "plan_required", error: CF_PLAN_DIALOG_MESSAGE };
    }
    throw new Error(formatted);
  }
  return {
    kind: "ok",
    domain: data.sending,
    parentZone: data.parentZone ?? "",
    routing: data.routing ?? {
      status: "dashboard_required",
      mxCreated: false,
      spfCreated: false,
      rulesCreated: false,
      dkimDashboardUrl: null,
      error: null,
    },
  };
}

export function SubdomainOnboardDialog({
  open,
  domain,
  parentZone,
  onOpenChange,
  onFixed,
}: {
  open: boolean;
  domain: string | null;
  parentZone?: string | null;
  onOpenChange: (open: boolean) => void;
  onFixed: () => void;
}) {
  const sendingHealth = useSendingHealth();
  const desktop = useOptionalDesktop();
  const connectedAccountId = connectedCfAccountId(desktop?.credentials);
  const emailSendingUrl = cloudflareEmailSendingUrl(connectedAccountId);

  const [subdomainInput, setSubdomainInput] = useState<string>("");
  const [parentZoneFound, setParentZoneFound] = useState<string | null>(null);
  const [zoneIdFound, setZoneIdFound] = useState<string | null>(null);
  const [phase, setPhase] = useState<DialogPhase>("input");
  const [steps, setSteps] = useState<DialogStep[]>(INITIAL_STEPS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<SubdomainDnsConflict[]>([]);
  const [routingResult, setRoutingResult] = useState<RoutingResult | null>(null);
  const [permissionChecks, setPermissionChecks] = useState<CfTokenPermissionCheck[]>([]);

  useEffect(() => {
    if (!open) return;
    setSubdomainInput(domain ?? "");
    setParentZoneFound(parentZone ?? null);
    setZoneIdFound(null);
    setPhase("input");
    setSteps(INITIAL_STEPS);
    setBusy(false);
    setError(null);
    setRecords([]);
    setRoutingResult(null);
    setPermissionChecks([]);
  }, [open, domain, parentZone]);

  const parentZoneHint = parentZoneFound ?? parentZone ?? null;
  const trimmedInput = subdomainInput.trim().toLowerCase();

  const inputValid = useMemo(() => {
    if (!trimmedInput) return false;
    if (!trimmedInput.includes(".")) return false;
    if (
      parentZoneHint &&
      !trimmedInput.endsWith(`.${parentZoneHint}`) &&
      trimmedInput !== parentZoneHint
    ) {
      return false;
    }
    return true;
  }, [trimmedInput, parentZoneHint]);

  async function runOnboard(confirmReplace: boolean) {
    if (!trimmedInput) return;
    setBusy(true);
    setError(null);
    setPhase("onboarding");
    setSteps(markSteps("zone", "running"));
    try {
      setSteps(markSteps("sending", "running"));
      const result = await postSubdomainOnboard(
        trimmedInput,
        confirmReplace,
        connectedAccountId,
      );
      if (result.kind === "needs_confirm") {
        setRecords(result.records);
        setError(result.error);
        setPhase("input");
        setSteps(markSteps("sending", "pending"));
        return;
      }
      if (result.kind === "no_parent_zone") {
        setError(result.error);
        setPhase("error");
        setSteps(markSteps("zone", "failed"));
        return;
      }
      if (result.kind === "plan_required") {
        setError(null);
        setPhase("plan_required");
        setSteps(INITIAL_STEPS);
        return;
      }
      if (result.kind === "permission_error") {
        setPermissionChecks(result.permissionChecks);
        setError(null);
        setPhase("error");
        setSteps(markSteps("sending", "failed"));
        return;
      }
      if (result.kind === "unavailable") {
        setError(result.error);
        setPhase("error");
        setSteps(markSteps("sending", "failed"));
        return;
      }
      setParentZoneFound(result.parentZone);
      setRoutingResult(result.routing);
      setSteps(markSteps("routing", "succeeded"));
      setSteps(markSteps("dkim", "succeeded"));
      sendingHealth.refresh();
      if (result.routing.status === "ready") {
        setPhase("verified");
        onFixed();
        return;
      }
      setPhase("dashboard_required");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Subdomain onboard failed";
      if (isCloudflarePlanError(message)) {
        setError(null);
        setPhase("plan_required");
        setSteps(INITIAL_STEPS);
      } else {
        setError(message);
        setPhase("error");
        setSteps(markSteps("sending", "failed"));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify() {
    setBusy(true);
    setError(null);
    try {
      await sendingHealth.refresh();
      const status = sendingHealth.statusForDomain(trimmedInput);
      if (status && status.status === "ready") {
        setPhase("verified");
        onFixed();
        return;
      }
      setError(
        status?.error ??
          "Cloudflare has not verified the subdomain yet. Wait 1-2 minutes for DNS to propagate, then click Verify again.",
      );
    } finally {
      setBusy(false);
    }
  }

  const routingDashboardUrl = useMemo(() => {
    if (routingResult?.dkimDashboardUrl) return routingResult.dkimDashboardUrl;
    if (connectedAccountId && zoneIdFound) {
      return cloudflareEmailRoutingUrl(connectedAccountId, zoneIdFound);
    }
    if (connectedAccountId) {
      return cloudflareEmailRoutingUrl(connectedAccountId);
    }
    return null;
  }, [routingResult, connectedAccountId, zoneIdFound]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(44rem,calc(100vh-2rem))] w-full max-w-[calc(100%-2rem)] flex-col overflow-hidden sm:max-w-lg"
        showCloseButton={!busy}
      >
        <DialogHeader className="min-w-0 shrink-0">
          <DialogTitle>Onboard subdomain</DialogTitle>
          <DialogDescription className="text-left break-words">
            Onboard a subdomain for Sending and Routing under an existing
            Cloudflare zone without affecting the parent domain&apos;s mail
            provider (e.g. Google Workspace).
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 min-w-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden">
          {phase === "input" ? (
            <div className="space-y-2">
              <Label htmlFor="subdomain-input" className="text-xs">
                Subdomain
              </Label>
              <Input
                id="subdomain-input"
                value={subdomainInput}
                onChange={(e) => {
                  setSubdomainInput(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && inputValid && !busy) {
                    e.preventDefault();
                    void runOnboard(false);
                  }
                }}
                placeholder={
                  parentZoneHint ? `mail.${parentZoneHint}` : "mail.example.com"
                }
                autoComplete="off"
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Enter the full subdomain (e.g.{" "}
                <span className="font-mono text-foreground">
                  {parentZoneHint ? `mail.${parentZoneHint}` : "mail.example.com"}
                </span>
                ). Relaybase will onboard Sending and Routing under the parent
                zone{parentZoneHint ? ` (${parentZoneHint})` : ""}.
              </p>
              {error ? (
                <p className="min-w-0 break-words whitespace-pre-wrap text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              {records.length ? (
                <div className="max-h-40 space-y-1.5 overflow-x-hidden overflow-y-auto rounded-md border p-3">
                  <p className="text-xs font-medium text-destructive">
                    These DNS records will be deleted and replaced
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
            </div>
          ) : null}

          {phase === "onboarding" ||
          phase === "dashboard_required" ||
          phase === "verified" ? (
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
          ) : null}

          {phase === "dashboard_required" ? (
            <div className="space-y-3">
              <div className="space-y-2 rounded-md border border-brand/40 bg-brand/5 p-3 text-xs">
                <p className="font-medium text-foreground">
                  Finish routing setup in Cloudflare
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  MX and SPF records were created on{" "}
                  <span className="font-mono text-foreground">{trimmedInput}</span>
                  . The parent zone is not in Email Routing because it uses
                  another mail provider (e.g. Google Workspace) — that is
                  expected. Open the zone&apos;s Email Routing page, go to{" "}
                  <span className="font-medium text-foreground">
                    Settings → Add subdomain
                  </span>
                  , and enter{" "}
                  <span className="font-mono text-foreground">
                    {trimmedInput}
                  </span>{" "}
                  as the subdomain. Then come back and click Verify.
                </p>
                {routingDashboardUrl ? (
                  <a
                    href={routingDashboardUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-brand hover:underline"
                  >
                    Open Cloudflare Email Routing
                    <ExternalLink className="size-3" />
                  </a>
                ) : null}
              </div>
              {error ? (
                <p className="min-w-0 break-words whitespace-pre-wrap text-sm text-muted-foreground">
                  {error}
                </p>
              ) : null}
            </div>
          ) : null}

          {phase === "verified" ? (
            <div className="space-y-1.5 rounded-md border border-brand/40 bg-brand/5 p-3 text-xs">
              <p className="font-medium text-foreground">Subdomain ready</p>
              <p className="text-muted-foreground leading-relaxed">
                <span className="font-mono text-foreground">{trimmedInput}</span>{" "}
                is onboarded for Sending and Routing. You can now create
                addresses on this subdomain.
              </p>
            </div>
          ) : null}

          {phase === "plan_required" ? (
            <div className="space-y-2">
              <p className="break-words text-sm text-muted-foreground">
                {CF_PLAN_DIALOG_MESSAGE}
              </p>
              {error ? (
                <p className="break-words whitespace-pre-wrap text-sm text-destructive">
                  {error}
                </p>
              ) : null}
            </div>
          ) : null}

          {phase === "error" ? (
            <div className="space-y-2">
              {error ? (
                <p className="min-w-0 break-words whitespace-pre-wrap text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              {permissionChecks.length > 0 ? (
                <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                  <p className="text-xs font-medium text-destructive">
                    Cloudflare API token permission missing
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Open Cloudflare → API Tokens, edit this token, add the
                    missing permission row, then click Start onboard again.
                  </p>
                  <CfApiTokenPermissionRows checks={permissionChecks} />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

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
          {phase === "input" ? (
            records.length ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={busy || !inputValid}
                onClick={() => void runOnboard(true)}
              >
                {busy ? "Replacing…" : "Replace records & continue"}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                disabled={busy || !inputValid}
                onClick={() => void runOnboard(false)}
              >
                {busy ? "Onboarding…" : "Start onboard"}
              </Button>
            )
          ) : null}
          {phase === "onboarding" ? (
            <Button
              type="button"
              size="sm"
              disabled
            >
              Onboarding…
            </Button>
          ) : null}
          {phase === "dashboard_required" ? (
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void handleVerify()}
            >
              {busy ? "Verifying…" : "Verify"}
            </Button>
          ) : null}
          {phase === "verified" ? (
            <Button
              type="button"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Done
            </Button>
          ) : null}
          {phase === "plan_required" ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={sendingHealth.refreshing}
                onClick={() => void sendingHealth.refresh()}
              >
                {sendingHealth.refreshing ? "Checking…" : "Recheck"}
              </Button>
              <Button
                type="button"
                size="sm"
                nativeButton={false}
                render={
                  <a href={emailSendingUrl} target="_blank" rel="noreferrer" />
                }
              >
                Open Cloudflare Email Sending
              </Button>
            </>
          ) : null}
          {phase === "error" ? (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setError(null);
                setRecords([]);
                setPermissionChecks([]);
                setPhase("input");
                setSteps(INITIAL_STEPS);
              }}
            >
              Back
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
