"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { OnboardingShell } from "./OnboardingShell";
import { Step1EmailApiCard } from "./Step1EmailApiCard";
import { Step2DomainCard } from "./Step2DomainCard";
import { Step3AccountCard } from "./Step3AccountCard";
import { Step4CompleteCard } from "./Step4CompleteCard";
import { useOnboardingState } from "../hooks/useOnboardingState";
import { getHqUser, hasHqSession, hqRefreshSession } from "@/lib/hq-auth/session";
import { ensureCloudWorkerSession } from "@/lib/auth/cloud-worker-session";

export function OnboardingWizard() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const {
    currentStep,
    completedSteps,
    summary,
    markStepComplete,
    goToStep,
  } = useOnboardingState();

  useEffect(() => {
    let active = true;

    async function checkAuth() {
      let ok = hasHqSession();
      if (!ok) {
        ok = await hqRefreshSession();
      }
      if (!ok) {
        if (active) {
          router.replace("/login?next=/onboarding");
        }
        return;
      }

      await ensureCloudWorkerSession().catch(() => false);
      if (active) {
        setAuthReady(true);
      }
    }

    void checkAuth();
    return () => {
      active = false;
    };
  }, [router]);

  if (!authReady) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <Loader2 className="size-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Preparing workspace…</p>
      </div>
    );
  }

  const user = getHqUser();
  const workerUrl = user?.workerUrl || summary.workerUrl || "";
  const accountId = user?.cfAccountId || summary.cfAccountId || "";

  return (
    <OnboardingShell
      currentStep={currentStep}
      completedSteps={completedSteps}
      onStepClick={goToStep}
    >
      {currentStep === "email-api" && (
        <Step1EmailApiCard
          workerUrl={workerUrl}
          accountId={accountId}
          onComplete={() => {
            markStepComplete("email-api", { emailApiVerified: true });
            goToStep("domain");
          }}
        />
      )}

      {currentStep === "domain" && (
        <Step2DomainCard
          accountId={accountId}
          onComplete={(domain) => {
            markStepComplete("domain", { activeDomain: domain });
            goToStep("account");
          }}
          onBack={() => goToStep("email-api")}
        />
      )}

      {currentStep === "account" && (
        <Step3AccountCard
          defaultDomain={summary.activeDomain || ""}
          onComplete={(email) => {
            markStepComplete("account", { createdAddress: email });
            goToStep("complete");
          }}
          onBack={() => goToStep("domain")}
        />
      )}

      {currentStep === "complete" && (
        <Step4CompleteCard
          activeDomain={summary.activeDomain}
          createdAddress={summary.createdAddress}
        />
      )}
    </OnboardingShell>
  );
}
