"use client";

import { useState, useCallback, useEffect } from "react";
import type { OnboardingStepId, OnboardingSummaryData } from "../lib/onboarding-types";
import { getHqUser } from "@/lib/hq-auth/session";

export function useOnboardingState() {
  const [currentStep, setCurrentStep] = useState<OnboardingStepId>("email-api");
  const [completedSteps, setCompletedSteps] = useState<Set<OnboardingStepId>>(new Set());
  const [summary, setSummary] = useState<OnboardingSummaryData>({
    emailApiVerified: false,
  });

  const [loadingSession, setLoadingSession] = useState(true);

  useEffect(() => {
    const user = getHqUser();
    if (user) {
      setSummary((prev) => ({
        ...prev,
        cfAccountId: user.cfAccountId || undefined,
        workerUrl: user.workerUrl || undefined,
      }));
    }
    setLoadingSession(false);
  }, []);

  const markStepComplete = useCallback(
    (step: OnboardingStepId, updates?: Partial<OnboardingSummaryData>) => {
      setCompletedSteps((prev) => {
        const next = new Set(prev);
        next.add(step);
        return next;
      });

      if (updates) {
        setSummary((prev) => ({ ...prev, ...updates }));
      }
    },
    [],
  );

  const goToStep = useCallback((step: OnboardingStepId) => {
    setCurrentStep(step);
  }, []);

  return {
    currentStep,
    completedSteps,
    summary,
    loadingSession,
    markStepComplete,
    goToStep,
  };
}
