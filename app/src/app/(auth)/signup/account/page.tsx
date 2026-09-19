"use client";

import { Suspense } from "react";

import { AppLoadingScreen } from "@/components/AppLoadingScreen";
import { SignupAccountForm } from "@/features/auth/components/SignupAccountForm";
import { SignupShell } from "@/features/auth/components/SignupShell";

export default function SignupAccountPage() {
  return (
    <SignupShell className="max-w-sm">
      <Suspense fallback={<AppLoadingScreen />}>
        <SignupAccountForm />
      </Suspense>
    </SignupShell>
  );
}
