"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { BootScreen } from "@/console/components/setup/BootScreen";
import { TeamLoginView } from "@/console/components/setup/TeamLoginView";
import { UnlockView } from "@/console/components/setup/UnlockView";
import { useAppSession } from "@/lib/desktop/app-session";
import { isDesktopRuntime } from "@/lib/desktop/bridge";
import { getWebTeamAuth } from "@/mail-platform/session/email-session";
import { hasWebOwnerSession } from "@/mail-platform/session/web-owner-session";

/**
 * Shared phase switch for `/` (outside the shell) and the dashboard gate.
 * `/` used to render BootScreen for every non-ready phase, so unlock / choice
 * never appeared and the window stayed on the shared loading screen.
 */
export function SessionPhaseScreen({
  children,
}: {
  children: (role: "owner" | "invited") => ReactNode;
}) {
  const store = useAppSession();
  const router = useRouter();
  const phase = store.phase;
  const [phaseReady, setPhaseReady] = useState(false);

  useEffect(() => {
    setPhaseReady(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isDesktopRuntime()) {
      if (getWebTeamAuth()) {
        router.replace("/inbox");
        return;
      }
      if (hasWebOwnerSession()) {
        router.replace("/dashboard");
        return;
      }
    }
    const path = window.location.pathname;
    if (phase.kind === "choice" && path !== "/setup") {
      router.replace("/setup");
      return;
    }
    if (
      (phase.kind === "ownerReady" || phase.kind === "invitedReady") &&
      !store.canShowApp &&
      path !== "/setup"
    ) {
      router.replace("/setup");
      return;
    }
    if (
      phase.kind === "ownerRecover" &&
      path !== "/setup/recover-admin" &&
      !path.startsWith("/setup/worker-update")
    ) {
      router.replace("/setup/recover-admin");
      return;
    }
    if (phase.kind === "install" && !path.startsWith("/setup")) {
      router.replace("/setup");
    }
  }, [phase.kind, router, store.canShowApp]);

  if (!phaseReady) {
    return <BootScreen />;
  }

  switch (phase.kind) {
    case "boot":
    case "choice":
    case "install":
    case "ownerRecover":
      return <BootScreen />;
    case "invitedLogin":
      return <TeamLoginView />;
    case "unlock":
      return <UnlockView role={phase.role} />;
    case "invitedReady":
      return store.canShowApp ? (
        <>{children("invited")}</>
      ) : (
        <BootScreen />
      );
    case "ownerReady":
      return store.canShowApp ? (
        <>{children("owner")}</>
      ) : (
        <BootScreen />
      );
    default:
      return <BootScreen />;
  }
}
