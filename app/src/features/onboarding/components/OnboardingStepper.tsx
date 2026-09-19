"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ONBOARDING_STEPS, type OnboardingStepId } from "../lib/onboarding-types";

export function OnboardingStepper({
  currentStep,
  completedSteps,
  onStepClick,
}: {
  currentStep: OnboardingStepId;
  completedSteps: Set<OnboardingStepId>;
  onStepClick?: (step: OnboardingStepId) => void;
}) {
  const currentIdx = ONBOARDING_STEPS.findIndex((s) => s.id === currentStep);

  return (
    <div className="w-full">
      <nav aria-label="Onboarding Progress" className="mx-auto">
        <ol className="grid grid-cols-4 gap-2 sm:gap-4">
          {ONBOARDING_STEPS.map((step, idx) => {
            const isCompleted = completedSteps.has(step.id);
            const isCurrent = step.id === currentStep;
            const isNavigable = isCompleted && onStepClick;

            return (
              <li key={step.id} className="relative flex flex-col items-center text-center">
                <button
                  type="button"
                  disabled={!isNavigable}
                  onClick={() => isNavigable && onStepClick(step.id)}
                  className={cn(
                    "group flex w-full flex-col items-center transition-all focus:outline-none",
                    isNavigable ? "cursor-pointer" : "cursor-default",
                  )}
                >
                  <div
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full border text-xs font-semibold transition-colors sm:size-9 sm:text-sm",
                      isCompleted
                        ? "border-emerald-500 bg-emerald-500 text-white shadow-sm dark:bg-emerald-600"
                        : isCurrent
                          ? "border-primary bg-primary text-primary-foreground shadow-sm"
                          : "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
                    )}
                  >
                    {isCompleted ? <Check className="size-4 stroke-[2.5]" /> : step.stepNumber}
                  </div>
                  <div className="mt-2 min-w-0">
                    <p
                      className={cn(
                        "truncate text-xs font-medium sm:text-sm",
                        isCurrent
                          ? "text-foreground font-semibold"
                          : isCompleted
                            ? "text-foreground"
                            : "text-muted-foreground",
                      )}
                    >
                      {step.title}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
      {/* Progress line */}
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all duration-300 ease-in-out"
          style={{
            width: `${Math.min(100, (currentIdx / (ONBOARDING_STEPS.length - 1)) * 100)}%`,
          }}
        />
      </div>
    </div>
  );
}
