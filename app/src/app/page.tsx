"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RestoreLastRoute } from "@/components/RestoreLastRoute";
import { SessionPhaseScreen } from "@/console/components/setup/SessionPhaseScreen";
import { isDesktopRuntime } from "@/lib/desktop/bridge";
import { getWebTeamAuth } from "@/mail-platform/session/email-session";
import { hasWebOwnerSession } from "@/mail-platform/session/web-owner-session";

/**
 * App entry.
 * Desktop and web share SessionPhaseScreen for setup / unlock routing.
 * Web shortcuts: owner session → /dashboard; team session → /inbox.
 */
export default function HomePage() {
  const router = useRouter();
  const isDesktop = isDesktopRuntime();
  const [webShowsSetup, setWebShowsSetup] = useState(isDesktop);

  useEffect(() => {
    if (isDesktop) return;
    if (hasWebOwnerSession()) {
      router.replace("/dashboard");
      return;
    }
    if (getWebTeamAuth()) {
      router.replace("/inbox");
      return;
    }
    setWebShowsSetup(true);
  }, [isDesktop, router]);

  if (!isDesktop && !webShowsSetup) {
    return null;
  }

  return (
    <SessionPhaseScreen>
      {() => (
        <RestoreLastRoute userId={isDesktop ? "desktop" : "web"} />
      )}
    </SessionPhaseScreen>
  );
}
