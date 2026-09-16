"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AppLoadingScreen } from "@/components/AppLoadingScreen";
import { HqCloudSignupView } from "@/console/components/setup/HqCloudSignupView";
import { hasHqSession, hqRefreshSession } from "@/lib/hq-auth/session";

function CloudSignupInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    async function boot() {
      if (hasHqSession()) {
        router.replace(next?.startsWith("/") ? next : "/studio/overview");
        return;
      }
      const hqOk = await hqRefreshSession();
      if (!active) return;
      if (hqOk) {
        router.replace(next?.startsWith("/") ? next : "/studio/overview");
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
  return <HqCloudSignupView />;
}

/** HQ Cloud sign-up — `/cloud/signup` (no shared tab UI with login). */
export default function CloudSignupPage() {
  return (
    <Suspense fallback={<AppLoadingScreen />}>
      <CloudSignupInner />
    </Suspense>
  );
}
