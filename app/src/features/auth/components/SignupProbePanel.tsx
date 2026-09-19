"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { CloudflareModuleIcon } from "@/console/components/CloudflareModuleIcon";
import {
  InstallWipeConfirmDialog,
  occupancySummary,
  resourceIsOccupied,
  wipePhraseIsValid,
} from "@/console/components/setup/common/install/InstallWipeConfirmDialog";
import { CheckingStateCard } from "@/features/auth/components/CheckingStateCard";
import { saveSignupInstallPlan } from "@/features/auth/lib/signup-session";
import type { InstallDecision, InstallResourceProbe } from "@/lib/desktop/bridge";
import { desktopProbeInstall } from "@/lib/desktop/bridge";
import { cn } from "@/lib/utils";

const WORKER_SCRIPT_NAME = "relaybase-api";

function decisionKey(r: Pick<InstallResourceProbe, "kind" | "name">) {
  return `${r.kind}:${r.name}`;
}

function resourceKindLabel(kind: string): "Worker" | "R2" | "D1" {
  if (kind === "r2") return "R2";
  if (kind === "d1") return "D1";
  return "Worker";
}

function toInstallDecisions(
  existing: InstallResourceProbe[],
  decisions: Record<string, "skip" | "reinstall">,
): InstallDecision[] {
  return existing.map((r) => ({
    kind: r.kind,
    name: r.name,
    action: decisions[decisionKey(r)] ?? "skip",
  }));
}

export function SignupProbePanel() {
  const router = useRouter();
  const [probing, setProbing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<InstallResourceProbe[]>([]);
  const [decisions, setDecisions] = useState<Record<string, "skip" | "reinstall">>({});
  const [cfAccountId, setCfAccountId] = useState("");
  const [cfAccountName, setCfAccountName] = useState("");
  const [wipeOpen, setWipeOpen] = useState(false);
  const [wipeTargets, setWipeTargets] = useState<InstallResourceProbe[]>([]);
  const [pendingContinue, setPendingContinue] = useState<InstallDecision[] | null>(null);
  const [lastWipePhrase, setLastWipePhrase] = useState<string | null>(null);

  async function readCfAccountName(): Promise<string> {
    const res = await fetch("/api/oauth/session", { credentials: "include" });
    const data = (await res.json()) as { accountName?: string };
    return data.accountName?.trim() || "";
  }

  const loadProbe = useCallback(async () => {
    setProbing(true);
    setError(null);
    try {
      const [probe, accountName] = await Promise.all([
        desktopProbeInstall(),
        readCfAccountName(),
      ]);
      setCfAccountId(probe.accountId?.trim() || "");
      setCfAccountName(accountName);
      let found = probe.resources.filter((r) => r.present);
      const workersDevUrl = probe.workersDevUrl?.trim() || null;
      if (
        found.length === 0 &&
        workersDevUrl &&
        !found.some((r) => r.kind === "worker")
      ) {
        found = [
          {
            kind: "worker",
            name: WORKER_SCRIPT_NAME,
            present: true,
            id: "",
          },
          ...found,
        ];
      }
      if (found.length === 0) {
        saveSignupInstallPlan({
          decisions: [],
          cfAccountId: probe.accountId,
          cfAccountName: accountName,
        });
        router.replace("/signup/install");
        return;
      }
      setExisting(found);
      setDecisions(Object.fromEntries(found.map((r) => [decisionKey(r), "skip"])));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check existing resources");
    } finally {
      setProbing(false);
    }
  }, [router]);

  useEffect(() => {
    void loadProbe();
  }, [loadProbe]);

  function continueInstall(plan: InstallDecision[], wipePhrase?: string | null) {
    const occupied = existing.filter(
      (r) => plan.find((d) => d.kind === r.kind && d.name === r.name)?.action === "reinstall" &&
        resourceIsOccupied(r),
    );
    const names = occupied.map((r) => r.name);
    if (
      occupied.length > 0 &&
      !wipePhraseIsValid(wipePhrase ?? lastWipePhrase ?? "", names)
    ) {
      setPendingContinue(plan);
      setWipeTargets(occupied);
      setWipeOpen(true);
      return;
    }
    saveSignupInstallPlan({
      decisions: plan,
      wipeConfirmation: wipePhrase ?? lastWipePhrase,
      cfAccountId,
      cfAccountName,
    });
    router.push("/signup/install");
  }

  if (probing) {
    return (
      <CheckingStateCard
        title="Checking Cloudflare Resources"
        description="Detecting existing Workers, D1 databases, and R2 mailbox storage on your account…"
      />
    );
  }

  if (error) {
    return (
      <div className="space-y-3 rounded-lg border p-4">
        <p className="text-sm text-destructive">{error}</p>
        <Button type="button" variant="outline" onClick={() => void loadProbe()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4 rounded-lg border p-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">Existing resources found</p>
          <p className="text-xs text-muted-foreground">
            Choose Skip to keep what is already on Cloudflare, or Reinstall to replace a
            resource. Reinstall on data-bearing buckets requires confirmation.
          </p>
        </div>
        <ul className="space-y-2">
          {existing.map((r) => {
            const key = decisionKey(r);
            const action = decisions[key] ?? "skip";
            return (
              <li
                key={key}
                className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <CloudflareModuleIcon
                    kind={resourceKindLabel(r.kind)}
                    className="size-5 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="font-mono text-xs">
                      <span className="text-muted-foreground">
                        {resourceKindLabel(r.kind)}
                      </span>{" "}
                      <span className="font-medium">{r.name}</span>
                    </p>
                    {occupancySummary(r) ? (
                      <p
                        className={cn(
                          "text-[11px]",
                          resourceIsOccupied(r)
                            ? "text-amber-700 dark:text-amber-400"
                            : "text-muted-foreground",
                        )}
                      >
                        {occupancySummary(r)}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={action === "skip" ? "default" : "outline"}
                    onClick={() => setDecisions((prev) => ({ ...prev, [key]: "skip" }))}
                  >
                    Skip
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={action === "reinstall" ? "default" : "outline"}
                    onClick={() => setDecisions((prev) => ({ ...prev, [key]: "reinstall" }))}
                  >
                    Reinstall
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setDecisions(Object.fromEntries(existing.map((r) => [decisionKey(r), "skip"])));
            }}
          >
            Skip all
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setDecisions(
                Object.fromEntries(existing.map((r) => [decisionKey(r), "reinstall"])),
              );
            }}
          >
            Reinstall all
          </Button>
        </div>
        <Button
          type="button"
          className="w-full"
          onClick={() => continueInstall(toInstallDecisions(existing, decisions))}
        >
          Continue install
        </Button>
      </div>
      <InstallWipeConfirmDialog
        open={wipeOpen}
        onOpenChange={setWipeOpen}
        title="Delete existing data and continue?"
        description="Reinstall will permanently delete data in the selected resources."
        targets={wipeTargets}
        confirmLabel="Delete and continue"
        requirePhrase
        onConfirm={(phrase) => {
          setLastWipePhrase(phrase);
          setWipeOpen(false);
          if (pendingContinue) {
            continueInstall(pendingContinue, phrase);
            setPendingContinue(null);
          }
        }}
      />
    </>
  );
}
