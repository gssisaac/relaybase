"use client";

import { Suspense } from "react";

import { AppLoadingScreen } from "@/components/AppLoadingScreen";
import { SignupModuleInstallPanel } from "@/features/auth/components/SignupModuleInstallPanel";
import { SignupShell } from "@/features/auth/components/SignupShell";

export default function SignupInstallPage() {
  return (
    <SignupShell>
      <Suspense fallback={<AppLoadingScreen />}>
        <SignupModuleInstallPanel />
      </Suspense>
    </SignupShell>
  );
}
