"use client";

import { Suspense } from "react";

import { AppLoadingScreen } from "@/components/AppLoadingScreen";
import { SignupProbePanel } from "@/features/auth/components/SignupProbePanel";
import { SignupShell } from "@/features/auth/components/SignupShell";

export default function SignupProbePage() {
  return (
    <SignupShell>
      <Suspense fallback={<AppLoadingScreen />}>
        <SignupProbePanel />
      </Suspense>
    </SignupShell>
  );
}
