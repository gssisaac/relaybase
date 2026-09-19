"use client";

import Link from "next/link";
import { Suspense } from "react";

import { AppLoadingScreen } from "@/components/AppLoadingScreen";
import { SignupShell } from "@/features/auth/components/SignupShell";
import { WebAuthorizeCard } from "@/console/components/setup/web/WebAuthorizeCard";

export default function SignupPage() {
  return (
    <SignupShell>
      <Suspense fallback={<AppLoadingScreen />}>
        <WebAuthorizeCard
          afterAuthPath="/signup/check"
          buttonLabel="Continue with Cloudflare"
        />
      </Suspense>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground hover:underline">
          Sign in
        </Link>
      </p>
    </SignupShell>
  );
}
