"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";

import { AppLoadingScreen } from "@/components/AppLoadingScreen";

import { LoginForm } from "@/features/auth/components/LoginForm";
import { hasCloudSession, cloudRefreshSession } from "@/lib/auth/cloud-session";
import { isDesktopRuntime } from "@/lib/desktop/bridge";

export default function CloudLoginPage() {
  const router = useRouter();
  const isDesktop = isDesktopRuntime();

  useEffect(() => {
    if (isDesktop) {
      router.replace("/");
      return;
    }
    let active = true;
    void (async () => {
      if (hasCloudSession()) {
        router.replace("/studio/dashboard");
        return;
      }
      const ok = await cloudRefreshSession();
      if (!active) return;
      if (ok) router.replace("/studio/dashboard");
    })();
    return () => {
      active = false;
    };
  }, [isDesktop, router]);

  if (isDesktop) {
    return <AppLoadingScreen />;
  }

  return (
    <Suspense fallback={<AppLoadingScreen />}>
      <LoginForm />
    </Suspense>
  );
}
