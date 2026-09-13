"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RestoreLastRoute } from "@/components/RestoreLastRoute";
import { SessionPhaseScreen } from "@/console/components/setup/SessionPhaseScreen";
import { isDesktopRuntime } from "@/lib/desktop/bridge";
import { getWebTeamAuth } from "@/mail-platform/session/email-session";

/**
 * App entry.
 * Desktop: SessionPhaseScreen handles keyring unlock / touch ID / setup.
 * Web: Redirects to /inbox if active web session exists, else /sign-in.
 */
export default function HomePage() {
  const router = useRouter();
  const isDesktop = isDesktopRuntime();

  useEffect(() => {
    if (!isDesktop) {
      const auth = getWebTeamAuth();
      if (auth) {
        router.replace("/inbox");
      } else {
        router.replace("/sign-in");
      }
    }
  }, [isDesktop, router]);

  if (!isDesktop) {
    return null;
  }

  return (
    <SessionPhaseScreen>
      {() => <RestoreLastRoute userId="desktop" />}
    </SessionPhaseScreen>
  );
}
