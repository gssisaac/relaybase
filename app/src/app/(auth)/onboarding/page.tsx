"use client";

import { Suspense } from "react";
import { AppLoadingScreen } from "@/components/AppLoadingScreen";
import { WebConsoleAppProviders } from "@/mail-platform/runtime";
import { SessionProvider } from "@/lib/dashboard/shared/ProductContext";
import { DomainProvider } from "@/lib/dashboard/DomainContext";
import { AccountsProvider } from "@/lib/dashboard/AccountsContext";
import { OnboardingWizard } from "@/features/onboarding/components/OnboardingWizard";

const ONBOARDING_USER_ID = "web-owner";

export default function OnboardingPage() {
  return (
    <WebConsoleAppProviders>
      <SessionProvider userId={ONBOARDING_USER_ID}>
        <DomainProvider>
          <AccountsProvider>
            <Suspense fallback={<AppLoadingScreen />}>
              <OnboardingWizard />
            </Suspense>
          </AccountsProvider>
        </DomainProvider>
      </SessionProvider>
    </WebConsoleAppProviders>
  );
}
