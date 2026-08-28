"use client";

import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { ConsoleGateView } from "@/console/components/setup/ConsoleGateView";
import { useAppSession } from "@/lib/desktop/app-session";
import { modeFromPathname } from "@/lib/navigation/sidebar-paths";

/**
 * Blocks dashboard routes until the owner has console access. Mail routes
 * pass through with mail-only tokens.
 */
export function ConsoleRouteGate({ children }: { children: ReactNode }) {
  const store = useAppSession();
  const pathname = usePathname();
  const isDashboard =
    modeFromPathname(pathname) === "dashboard" &&
    store.phase.kind === "ownerReady";

  useEffect(() => {
    if (!isDashboard || store.hasConsoleAccess) return;
    if (!store.consoleGateOpen) {
      void store.ensureConsoleAccess();
    }
  }, [isDashboard, store, pathname]);

  if (isDashboard && (store.consoleGateOpen || !store.hasConsoleAccess)) {
    return <ConsoleGateView />;
  }

  return <>{children}</>;
}
