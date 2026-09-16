"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppLoadingScreen } from "@/components/AppLoadingScreen";
import { RestoreLastRoute } from "@/components/RestoreLastRoute";
import { SessionPhaseScreen } from "@/console/components/setup/SessionPhaseScreen";
import { isDesktopRuntime } from "@/lib/desktop/bridge";
import { getWebTeamAuth } from "@/mail-platform/session/email-session";
import { hasHqSession, hqRefreshSession } from "@/lib/hq-auth/session";
import { hasWebOwnerSession } from "@/mail-platform/session/web-owner-session";

/**
 * App entry.
 * Desktop: SessionPhaseScreen owns setup / unlock routing (welcome `/setup`).
 * Web: never render a form here — bounce to `/dashboard`, `/inbox`, or `/login`
 * immediately so the address bar is `/login`, not `/`. Session restore runs
 * on the `/login` page.
 */
export default function HomePage() {
  const router = useRouter();
  const isDesktop = isDesktopRuntime();

  useEffect(() => {
    if (isDesktop) return;

    let active = true;
    async function routeWebHome() {
      if (hasHqSession()) {
        router.replace("/studio/overview");
        return;
      }
      const hqOk = await hqRefreshSession();
      if (!active) return;
      if (hqOk) {
        router.replace("/studio/overview");
        return;
      }
      if (hasWebOwnerSession()) {
        router.replace("/dashboard");
        return;
      }
      if (getWebTeamAuth()) {
        router.replace("/inbox");
        return;
      }
      router.replace("/cloud/login");
    }

    void routeWebHome();
    return () => {
      active = false;
    };
  }, [isDesktop, router]);

  if (!isDesktop) {
    return <AppLoadingScreen />;
  }

  return (
    <SessionPhaseScreen>
      {() => <RestoreLastRoute userId="desktop" />}
    </SessionPhaseScreen>
  );
}
