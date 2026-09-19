"use client";

import { Suspense } from "react";

import { AppLoadingScreen } from "@/components/AppLoadingScreen";
import { SignupWizard } from "@/features/auth/components/SignupWizard";

export default function SignupPage() {
  return (
    <Suspense fallback={<AppLoadingScreen />}>
      <SignupWizard />
    </Suspense>
  );
}
