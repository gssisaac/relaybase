"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AppLoadingScreen } from "@/components/AppLoadingScreen";
import { HqStudioSignupView } from "@/console/components/setup/common/auth/HqStudioSignupView";
import { hasHqSession, hqRefreshSession } from "@/lib/hq-auth/session";

function StudioSignupInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    async function boot() {
      if (hasHqSession()) {
        router.replace(next?.startsWith("/") ? next : "/studio/dashboard");
        return;
      }
      const hqOk = await hqRefreshSession();
      if (!active) return;
      if (hqOk) {
        router.replace(next?.startsWith("/") ? next : "/studio/dashboard");
        return;
      }
      setReady(true);
    }

    void boot();
    return () => {
      active = false;
    };
  }, [next, router]);

  if (!ready) return <AppLoadingScreen />;
  return <HqStudioSignupView />;
}

/** Relaybase Studio sign-up — `/studio/signup` (no shared tab UI with login). */
export default function StudioSignupPage() {
  return (
    <Suspense fallback={<AppLoadingScreen />}>
      <StudioSignupInner />
    </Suspense>
  );
}
