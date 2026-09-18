"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AppLoadingScreen } from "@/components/AppLoadingScreen";
import { AccountLoginView } from "@/console/components/setup/common/auth/AccountLoginView";
import { restoreWebOwnerSession } from "@/lib/desktop/auth";
import { EmailAppProviders } from "@/mail-platform/runtime";
import { getWebTeamAuth } from "@/mail-platform/session/email-session";
import { hasWebOwnerSession } from "@/mail-platform/session/web-owner-session";

function WorkerLoginInner() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    async function boot() {
      if (hasWebOwnerSession()) {
        router.replace("/dashboard");
        return;
      }
      if (getWebTeamAuth()) {
        router.replace("/inbox");
        return;
      }
      const restored = await restoreWebOwnerSession();
      if (!active) return;
      if (restored && hasWebOwnerSession()) {
        router.replace("/dashboard");
        return;
      }
      setReady(true);
    }

    void boot();
    return () => {
      active = false;
    };
  }, [router]);

  if (!ready) return <AppLoadingScreen />;

  return (
    <EmailAppProviders>
      <AccountLoginView defaultRole="owner" />
    </EmailAppProviders>
  );
}

/** Worker passtoken / teammate login — separate URL from `/studio/login`. */
export default function WorkerLoginPage() {
  return (
    <Suspense fallback={<AppLoadingScreen />}>
      <WorkerLoginInner />
    </Suspense>
  );
}
