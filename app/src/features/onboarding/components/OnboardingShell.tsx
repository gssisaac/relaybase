"use client";

import type { ReactNode } from "react";
import { AuthPageBrandMark } from "@/console/components/setup/common/layout/AuthPageBrandMark";
import { OnboardingStepper } from "./OnboardingStepper";
import type { OnboardingStepId } from "../lib/onboarding-types";
import { cn } from "@/lib/utils";

export function OnboardingShell({
  currentStep,
  completedSteps,
  onStepClick,
  children,
  className,
}: {
  currentStep: OnboardingStepId;
  completedSteps: Set<OnboardingStepId>;
  onStepClick?: (step: OnboardingStepId) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-8 sm:py-12",
        className,
      )}
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <AuthPageBrandMark className="size-11" />
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          Complete Your Setup
        </h1>
        <p className="max-w-md text-xs text-muted-foreground sm:text-sm">
          Follow 3 quick steps to enable Cloudflare Email API, connect your domain, and create your initial mailbox.
        </p>
      </div>

      <div className="rounded-xl border bg-card/60 p-4 shadow-sm backdrop-blur-sm sm:p-6">
        <OnboardingStepper
          currentStep={currentStep}
          completedSteps={completedSteps}
          onStepClick={onStepClick}
        />

        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
