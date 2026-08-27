"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { BootScreen } from "@/console/components/setup/BootScreen";
import { OfferBiometryView } from "@/console/components/setup/OfferBiometryView";
import { TeamLoginView } from "@/console/components/setup/TeamLoginView";
import { UnlockView } from "@/console/components/setup/UnlockView";
import { useAppSession } from "@/lib/desktop/AppSessionContext";

/**
 * Shared phase switch for `/` (outside the shell) and the dashboard gate.
 * `/` used to render BootScreen for every non-ready phase, so unlock / choice
 * never appeared and the window stayed on "Loading…".
 */
export function SessionPhaseScreen({
  children,
}: {
  children: (role: "owner" | "invited") => ReactNode;
}) {
  const store = useAppSession();
  const router = useRouter();
  const phase = store.phase;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const path = window.location.pathname;
    if (phase.kind === "choice" && path !== "/setup") {
      router.replace("/setup");
      return;
    }
    if (phase.kind === "ownerRecover" && path !== "/setup/recover-admin") {
      router.replace("/setup/recover-admin");
      return;
    }
    if (phase.kind === "install" && !path.startsWith("/setup")) {
      router.replace("/setup");
    }
  }, [phase.kind, router]);

  switch (phase.kind) {
    case "boot":
    case "choice":
    case "install":
    case "ownerRecover":
      return <BootScreen />;
    case "invitedLogin":
      return <TeamLoginView />;
    case "offerBiometry":
      return <OfferBiometryView role={phase.role} />;
    case "unlock":
      return <UnlockView role={phase.role} mode={phase.mode} />;
    case "invitedReady":
      return <>{children("invited")}</>;
    case "ownerReady":
      return <>{children("owner")}</>;
    default:
      return <BootScreen />;
  }
}
