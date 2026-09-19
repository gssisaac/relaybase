"use client";

import { Check, ExternalLink, Loader2, Shield } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { CloudflareModuleIcon } from "@/console/components/CloudflareModuleIcon";
import { RollbackModulesDialog } from "@/features/auth/components/RollbackModulesDialog";
import {
  SIGNUP_INSTALL_MODULES,
  SIGNUP_MODULE_ORDER,
  installLogModuleForStep,
} from "@/features/auth/lib/signup-install-modules";
import { signupModuleDashboardUrl } from "@/features/auth/lib/signup-module-dashboard-url";
import {
  readSignupInstallPlan,
  saveSignupInstallToken,
} from "@/features/auth/lib/signup-session";
import {
  runWebInstallStream,
  subscribeWebInstallLog,
  subscribeWebInstallModule,
  type InstallModuleId,
  type InstallModuleStatus,
} from "@/lib/desktop/bridge/web-install-stream";
import { cn } from "@/lib/utils";

function initialModuleStatuses(): Record<InstallModuleId, InstallModuleStatus> {
  return {
    r2: "pending",
    d1: "pending",
    worker: "pending",
    secrets: "pending",
    schema: "pending",
  };
}

export function SignupModuleInstallPanel() {
  const router = useRouter();
  const installStartedRef = useRef(false);
  const [cfAccountId, setCfAccountId] = useState("");
  const [cfAccountName, setCfAccountName] = useState("");
  const [statuses, setStatuses] = useState(initialModuleStatuses);
  const [moduleLogs, setModuleLogs] = useState<Record<InstallModuleId, string[]>>(() => ({
    r2: [],
    d1: [],
    worker: [],
    secrets: [],
    schema: [],
  }));
  const [expandedLog, setExpandedLog] = useState<InstallModuleId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [installing, setInstalling] = useState(true);
  const [installComplete, setInstallComplete] = useState(false);
  const [pendingInstallToken, setPendingInstallToken] = useState("");
  const [rollbackOpen, setRollbackOpen] = useState(false);

  const runInstall = useCallback(async () => {
    const plan = readSignupInstallPlan();
    if (!plan) {
      router.replace("/signup/probe");
      return;
    }
    setCfAccountId(plan.cfAccountId);
    setCfAccountName(plan.cfAccountName);
    setError(null);
    setInstalling(true);
    setInstallComplete(false);
    setPendingInstallToken("");
    setStatuses(initialModuleStatuses());
    setModuleLogs({ r2: [], d1: [], worker: [], secrets: [], schema: [] });
    try {
      const result = await runWebInstallStream({
        accountId: plan.cfAccountId,
        decisions: plan.decisions,
        wipeConfirmation: plan.wipeConfirmation,
        cloudSignup: true,
      });
      if (!("installToken" in result) || !result.installToken) {
        throw new Error("Install finished but cloud signup token was missing.");
      }
      setPendingInstallToken(result.installToken);
      setInstallComplete(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Install failed");
    } finally {
      setInstalling(false);
    }
  }, [router]);

  useEffect(() => {
    const unsubLog = subscribeWebInstallLog((ev) => {
      const moduleId = installLogModuleForStep(ev.step);
      if (!moduleId) return;
      const line = ev.line.trim();
      if (!line) return;
      setModuleLogs((prev) => ({
        ...prev,
        [moduleId]: [...prev[moduleId].slice(-80), line],
      }));
    });
    const unsubModule = subscribeWebInstallModule((ev) => {
      setStatuses((prev) => ({ ...prev, [ev.id]: ev.status }));
    });
    return () => {
      unsubLog();
      unsubModule();
    };
  }, []);

  useEffect(() => {
    if (installStartedRef.current) return;
    installStartedRef.current = true;
    void runInstall();
  }, [runInstall]);

  const activeIndex = useMemo(() => {
    const running = SIGNUP_MODULE_ORDER.findIndex((id) => statuses[id] === "running");
    if (running >= 0) return running;
    const lastDone = [...SIGNUP_MODULE_ORDER]
      .reverse()
      .findIndex((id) => statuses[id] === "done");
    if (lastDone >= 0) return SIGNUP_MODULE_ORDER.length - 1 - lastDone;
    return -1;
  }, [statuses]);

  function cardOpacity(id: InstallModuleId): string {
    const idx = SIGNUP_MODULE_ORDER.indexOf(id);
    const status = statuses[id];
    if (status === "running" || status === "done" || status === "error") {
      return "opacity-100";
    }
    if (activeIndex < 0) return "opacity-40";
    return idx <= activeIndex + 1 ? "opacity-100" : "opacity-40";
  }

  function continueToSignup() {
    if (!pendingInstallToken || !cfAccountId) return;
    saveSignupInstallToken(pendingInstallToken, cfAccountId, cfAccountName);
    router.push("/signup/account");
  }

  return (
    <div className="space-y-3">
      <p className="text-center text-sm text-muted-foreground">
        {installComplete
          ? "Installation finished. Verify resources in Cloudflare, then continue."
          : installing
            ? "Installing Relaybase on your Cloudflare account…"
            : "Installation stopped."}
      </p>
      <ul className="space-y-2">
        {SIGNUP_INSTALL_MODULES.map((mod) => {
          const status = statuses[mod.id];
          const logs = moduleLogs[mod.id];
          const logOpen = expandedLog === mod.id;
          const dashUrl =
            status === "done" && cfAccountId
              ? signupModuleDashboardUrl(mod.id, cfAccountId)
              : null;
          return (
            <li
              key={mod.id}
              className={cn(
                "rounded-lg border px-4 py-3 transition-opacity duration-500",
                cardOpacity(mod.id),
              )}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  {mod.icon === "Shield" ? (
                    <Shield className="size-5 text-[#F38020]" aria-hidden />
                  ) : (
                    <CloudflareModuleIcon kind={mod.icon} className="size-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{mod.title}</p>
                      <p className="text-xs text-muted-foreground">{mod.description}</p>
                    </div>
                    <div className="shrink-0 pt-0.5">
                      {status === "running" ? (
                        <Loader2 className="size-4 animate-spin text-brand" />
                      ) : status === "done" ? (
                        <Check className="size-4 text-emerald-600" />
                      ) : null}
                    </div>
                  </div>
                  {dashUrl ? (
                    <a
                      href={dashUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
                    >
                      Open in Cloudflare
                      <ExternalLink className="size-3" />
                    </a>
                  ) : null}
                  {logs.length > 0 ? (
                    <button
                      type="button"
                      className="mt-2 block text-xs text-brand hover:underline"
                      onClick={() => setExpandedLog(logOpen ? null : mod.id)}
                    >
                      {logOpen ? "Hide log" : "See log"}
                    </button>
                  ) : null}
                  {logOpen && logs.length > 0 ? (
                    <pre className="mt-2 max-h-32 overflow-auto rounded-md bg-muted/50 p-2 text-[10px] leading-relaxed">
                      {logs.join("\n")}
                    </pre>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {installComplete ? (
        <div className="space-y-3 pt-1 text-center">
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
            All modules installed
          </p>
          <p className="text-xs text-muted-foreground">
            Confirm each resource in Cloudflare above, then continue. You can roll back individual
            modules first if needed.
          </p>
          <Button type="button" className="w-full" onClick={continueToSignup}>
            Continue to sign up
          </Button>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
            onClick={() => setRollbackOpen(true)}
          >
            Rollback selected modules
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="space-y-2 rounded-lg border border-destructive/40 p-4">
          <p className="text-sm text-destructive">{error}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" className="flex-1" onClick={() => void runInstall()}>
              Try again
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => router.push("/signup/probe")}
            >
              Back
            </Button>
          </div>
          {cfAccountId ? (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground hover:underline"
              onClick={() => setRollbackOpen(true)}
            >
              Rollback selected modules
            </button>
          ) : null}
        </div>
      ) : null}

      {!installComplete && !error && cfAccountId && !installing ? (
        <p className="text-center">
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
            onClick={() => setRollbackOpen(true)}
          >
            Rollback selected modules
          </button>
        </p>
      ) : null}

      {cfAccountId ? (
        <RollbackModulesDialog
          open={rollbackOpen}
          onOpenChange={setRollbackOpen}
          cfAccountId={cfAccountId}
          onRollbackSuccess={() => {
            setInstallComplete(false);
            setPendingInstallToken("");
            router.push("/signup/probe");
          }}
        />
      ) : null}
    </div>
  );
}
