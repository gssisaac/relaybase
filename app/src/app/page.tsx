"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RestoreLastRoute } from "@/components/RestoreLastRoute";
import { SessionPhaseScreen } from "@/console/components/setup/SessionPhaseScreen";
import { isDesktopRuntime } from "@/lib/desktop/bridge";
import { getWebTeamAuth } from "@/mail-platform/session/email-session";
import { hasWebOwnerSession } from "@/mail-platform/session/web-owner-session";

/**
 * App entry.
 * Desktop: SessionPhaseScreen handles keyring unlock / touch ID / setup.
 * Web: same console/dashboard access as desktop when an owner session is
 * live (/dashboard); /inbox for a team session; else /sign-in.
 */
export default function HomePage() {
  const router = useRouter();
  const isDesktop = isDesktopRuntime();

  useEffect(() => {
    if (!isDesktop) {
      if (hasWebOwnerSession()) {
        router.replace("/dashboard");
      } else if (getWebTeamAuth()) {
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
