"use client";

import { CheckCircle2, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { FieldCheck } from "@/components/ui/field-check";
import {
  desktopAdoptWorker,
  desktopInstallWorker,
  desktopProbeWorker,
  explainDesktopError,
  type DesktopErrorHelp,
  type ProbeResult,
} from "@/lib/desktop/bridge";
import { DesktopErrorBanner } from "@/lib/desktop/DesktopErrorBanner";
import { useDesktop } from "@/lib/desktop/DesktopContext";

const PLANNED_RESOURCES = [
  {
    name: "relaybase-api",
    kind: "Worker",
    why: "Runs email routing, the admin API, and inbound handlers inside your Cloudflare account — not on Relaybase-hosted infrastructure.",
  },
  {
    name: "relaybase-keys",
    kind: "KV",
    why: "Stores admin config and API keys. Kept in your account so credentials never leave your Cloudflare project.",
  },
  {
    name: "relaybase-api",
    kind: "KV",
    why: "Stores Relaybase runtime data (domains, settings) next to the Worker that serves them.",
  },
  {
    name: "relaybase-inbound",
    kind: "R2",
    why: "Persists raw inbound email so you can inspect and process mail without a third-party mailbox store.",
  },
] as const;

function statusLabel(status: string) {
  if (status === "ready") return "Already installed";
  if (status === "partial") return "Partially installed";
  return "Not installed";
}

export function WorkerInstallPanel() {
  const router = useRouter();
  const { refresh, credentials } = useDesktop();
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [busy, setBusy] = useState<"probe" | "adopt" | "install" | null>(
    "probe",
  );
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState<DesktopErrorHelp | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function runProbe() {
    setBusy("probe");
    setError(null);
    setMessage(null);
    try {
      const result = await desktopProbeWorker();
      setProbe(result);
    } catch (err) {
      setProbe(null);
      setError(explainDesktopError(err, "Verification (probe) failed"));
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    if (!credentials?.accountId || !credentials.apiToken) {
      router.replace("/setup/connect");
      return;
    }
    void runProbe();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- probe once on mount when credentials exist
  }, [credentials?.accountId, credentials?.apiToken]);

  async function handleSkipAdopt() {
    setBusy("adopt");
    setError(null);
    setMessage(null);
    try {
      const result = await desktopAdoptWorker();
      setMessage(
        result.adminRelinked
          ? `Existing Worker at ${result.workerUrl} linked. Admin token was refreshed in ~/.relaybase.`
          : `Existing Worker at ${result.workerUrl} linked. Install skipped.`,
      );
      await refresh();
      router.push("/setup/license");
    } catch (err) {
      setError(explainDesktopError(err, "Could not link existing Worker"));
    } finally {
      setBusy(null);
    }
  }

  async function handleInstall() {
    if (!approved) return;
    setBusy("install");
    setError(null);
    setMessage(null);
    try {
      const result = await desktopInstallWorker();
      setMessage(
        result.skipped
          ? `Already present — linked ${result.workerUrl}.`
          : `Installed Worker at ${result.workerUrl}.`,
      );
      await refresh();
      router.push("/setup/license");
    } catch (err) {
      setError(explainDesktopError(err, "Install failed"));
    } finally {
      setBusy(null);
    }
  }

  const ready = probe?.status === "ready";
  const needsInstall = probe != null && !ready;

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Step 2 of 3
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Install routing Worker
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Relaybase deploys a small set of named resources into{" "}
          <strong>your</strong> Cloudflare account. Matching is by exact name —
          if they already exist and respond healthy, we skip the upload.
        </p>
      </div>

      <div className="space-y-3 rounded-lg border border-border p-4">
        <p className="text-sm font-medium">What we install (and why)</p>
        <ul className="space-y-3">
          {PLANNED_RESOURCES.map((r) => (
            <li key={`${r.kind}-${r.name}`} className="text-sm">
              <p className="font-mono text-xs">
                <span className="text-muted-foreground">{r.kind}</span>{" "}
                <span className="font-medium text-foreground">{r.name}</span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{r.why}</p>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Other Workers in the account are left alone. Only resources with these
          exact names are reused or created.
        </p>
      </div>

      <div className="space-y-3 rounded-lg border border-border p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">Verification</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy !== null}
            onClick={() => void runProbe()}
          >
            {busy === "probe" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            Re-check
          </Button>
        </div>

        {busy === "probe" && !probe ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Checking Cloudflare for existing Relaybase resources…
          </p>
        ) : null}

        {probe ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 text-sm">
              {ready ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              ) : (
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
              )}
              <div>
                <p className="font-medium">{statusLabel(probe.status)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {probe.summary}
                </p>
                {probe.workerUrl ? (
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {probe.workerUrl}
                    {probe.healthOk ? " · /health ok" : " · /health failed"}
                  </p>
                ) : null}
              </div>
            </div>
            <ul className="space-y-1.5 border-t border-border pt-3">
              {probe.resources.map((r) => (
                <li
                  key={`${r.kind}-${r.name}`}
                  className="flex items-start justify-between gap-3 text-xs"
                >
                  <span className="font-mono">
                    <span className="text-muted-foreground">{r.kind}</span>{" "}
                    {r.name}
                  </span>
                  <span
                    className={
                      r.present
                        ? "shrink-0 text-emerald-700 dark:text-emerald-400"
                        : "shrink-0 text-muted-foreground"
                    }
                  >
                    {r.present ? "Found" : "Missing"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {needsInstall ? (
        <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
          <FieldCheck
            id="approve-install"
            checked={approved}
            onCheckedChange={setApproved}
            label="I approve creating or completing these named resources in my Cloudflare account"
            description="KV/R2 with matching names are reused. A missing or unhealthy Worker script named relaybase-api will be uploaded."
          />
        </div>
      ) : null}

      <DesktopErrorBanner error={error} />
      {message ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">
          {message}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          disabled={busy !== null}
          onClick={() => router.push("/setup/connect")}
        >
          Back
        </Button>
        <div className="flex flex-col gap-2 sm:flex-row">
          {ready ? (
            <Button
              type="button"
              disabled={busy !== null}
              onClick={() => void handleSkipAdopt()}
            >
              {busy === "adopt" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : null}
              Use existing Worker
            </Button>
          ) : (
            <Button
              type="button"
              disabled={!approved || busy !== null || !probe}
              onClick={() => void handleInstall()}
            >
              {busy === "install" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : null}
              Approve &amp; install
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
