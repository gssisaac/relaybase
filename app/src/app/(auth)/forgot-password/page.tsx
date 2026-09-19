"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";

import { AppLoadingScreen } from "@/components/AppLoadingScreen";
import { ResetPasswordOAuthForm } from "@/features/auth/components/ResetPasswordOAuthForm";
import { fetchWebCfOAuthSessionPresent } from "@/lib/desktop/bridge/web-oauth-complete";

function ForgotPasswordInner() {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("verified") !== "1") return;
    void fetchWebCfOAuthSessionPresent();
  }, [searchParams]);

  return <ResetPasswordOAuthForm />;
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<AppLoadingScreen />}>
      <ForgotPasswordInner />
    </Suspense>
  );
}
