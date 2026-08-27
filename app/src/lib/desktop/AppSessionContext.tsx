"use client";

import * as React from "react";

import {
  AppSessionStore,
  type AppSessionPhase,
  type SessionRole,
} from "@/lib/desktop/app-session-store";
import {
  desktopOwnerSessionStatus,
  desktopTeamSessionStatus,
  isDesktopRuntime,
} from "@/lib/desktop/bridge";
import { useDesktop } from "@/lib/desktop/DesktopContext";

const AppSessionContext = React.createContext<AppSessionStore | null>(null);

/**
 * Wires `AppSessionStore` to `DesktopContext`. Boot fetches owner + team
 * keyring status in parallel and triggers the biometric prompt the moment a
 * secret is present — before any unlock view mounts. This is the fix for the
 * "Touch ID doesn't appear on launch" waterfall.
 */
export function AppSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const desktop = useDesktop();
  const storeRef = React.useRef<AppSessionStore | null>(null);
  if (storeRef.current === null) storeRef.current = new AppSessionStore();
  const store = storeRef.current;

  // Boot once: parallel keyring status fetch + immediate prompt.
  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [ownerStatus, teamStatus] = await Promise.all([
        desktopOwnerSessionStatus(),
        desktopTeamSessionStatus(),
      ]);
      if (cancelled) return;
      store.setStatuses(ownerStatus, teamStatus);
    })();
    return () => {
      cancelled = true;
    };
  }, [store]);

  // Mirror DesktopContext identity into the store so non-prompt phases
  // (choice / invitedLogin / owner secret form) resolve once ready.
  React.useEffect(() => {
    store.setIdentity({
      ready: desktop.ready,
      isDesktop: isDesktopRuntime(),
      credentials: desktop.credentials,
      teamIdentity: desktop.teamLogin,
    });
  }, [
    store,
    desktop.ready,
    desktop.credentials,
    desktop.teamLogin,
  ]);

  return (
    <AppSessionContext.Provider value={store}>
      {children}
    </AppSessionContext.Provider>
  );
}

export function useAppSession(): AppSessionStore {
  const ctx = React.useContext(AppSessionContext);
  if (!ctx) throw new Error("AppSessionProvider required");
  return ctx;
}

export type { AppSessionPhase, SessionRole };
