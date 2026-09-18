"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AppLoadingScreen } from "@/components/AppLoadingScreen";
import { HqStudioLoginView } from "@/console/components/setup/common/auth/HqStudioLoginView";
import { hasHqSession, hqRefreshSession } from "@/lib/hq-auth/session";

function StudioLoginInner() {
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
  return <HqStudioLoginView />;
}

/** Relaybase Studio sign-in — separate URL so Chrome autofill stays distinct from Worker login. */
export default function StudioLoginPage() {
  return (
    <Suspense fallback={<AppLoadingScreen />}>
      <StudioLoginInner />
    </Suspense>
  );
}
