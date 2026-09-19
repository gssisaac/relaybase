"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppLoadingScreen } from "@/components/AppLoadingScreen";
import { RestoreLastRoute } from "@/components/RestoreLastRoute";
import { SessionPhaseScreen } from "@/console/components/setup/common/layout/SessionPhaseScreen";
import { ensureWebCloudAuth } from "@/lib/auth/cloud-worker-session";
import { isDesktopRuntime } from "@/lib/desktop/bridge";
import {
  DEFAULT_DASHBOARD_PATH,
  DEFAULT_STUDIO_PATH,
} from "@/lib/navigation/sidebar-paths";

/**
 * App entry.
 * Desktop: SessionPhaseScreen owns setup / unlock routing (welcome `/setup`).
 * Web: cloud session only — `/login` when unauthenticated.
 */
export default function HomePage() {
  const router = useRouter();
  const isDesktop = isDesktopRuntime();

  useEffect(() => {
    if (isDesktop) return;

    let active = true;
    async function routeWebHome() {
      const auth = await ensureWebCloudAuth();
      if (!active) return;
      if (auth === "login") {
        router.replace("/login");
        return;
      }
      if (auth === "ready") {
        router.replace(DEFAULT_DASHBOARD_PATH);
        return;
      }
      router.replace(DEFAULT_STUDIO_PATH);
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
