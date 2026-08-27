"use client";

import * as React from "react";
import { reaction } from "mobx";

import {
  AppSessionStore,
  type AppSessionPhase,
  type SessionRole,
} from "@/lib/desktop/app-session-store";
import {
  desktopOwnerSessionStatus,
  desktopTeamSessionStatus,
  isDesktopRuntime,
  type OwnerSessionStatus,
  type TeamSessionStatus,
} from "@/lib/desktop/bridge";
import { useDesktop } from "@/lib/desktop/DesktopContext";

const EMPTY_OWNER: OwnerSessionStatus = {
  hasRefresh: false,
  hasAccess: false,
  username: "",
  workerUrl: "",
  biometryEnabled: true,
  platform: "macos",
};

const EMPTY_TEAM: TeamSessionStatus = {
  hasSecret: false,
  hasAccess: false,
  accountEmail: "",
  workerUrl: "",
  biometryEnabled: true,
  platform: "macos",
};

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
  const [store] = React.useState(() => new AppSessionStore());

  // Boot once: parallel keyring status fetch + immediate prompt.
  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [ownerStatus, teamStatus] = await Promise.all([
          desktopOwnerSessionStatus(),
          desktopTeamSessionStatus(),
        ]);
        if (cancelled) return;
        store.setStatuses(ownerStatus, teamStatus);
      } catch {
        // A keyring read failure must still leave boot, otherwise the window
        // stays on "Loading…" forever.
        if (cancelled) return;
        store.setStatuses(EMPTY_OWNER, EMPTY_TEAM);
      }
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

  // Global 401 handler: re-prompt unlock without wiping the worker URL or
  // keyring. The refresh may simply be stale; the store falls back to the
  // secret form if it was revoked.
  React.useEffect(() => {
    function onUnauthorized() {
      void store.handleWorkerUnauthorized();
    }
    window.addEventListener("relaybase:unauthorized", onUnauthorized);
    return () =>
      window.removeEventListener("relaybase:unauthorized", onUnauthorized);
  }, [store]);

  return (
    <AppSessionContext.Provider value={store}>
      {children}
    </AppSessionContext.Provider>
  );
}

/**
 * MobX store with a React subscription so non-observer components re-render
 * when the phase (or busy/error) changes. Without this, `/` and the gate
 * stay on BootScreen after boot() finishes.
 */
export function useAppSession(): AppSessionStore {
  const ctx = React.useContext(AppSessionContext);
  if (!ctx) throw new Error("AppSessionProvider required");
  const [, setTick] = React.useState(0);

  React.useEffect(() => {
    return reaction(
      () =>
        JSON.stringify({
          kind: ctx.phase.kind,
          mode: ctx.phase.kind === "unlock" ? ctx.phase.mode : "",
          role: ctx.phase.kind === "unlock" ? ctx.phase.role : "",
          step: ctx.phase.kind === "install" ? ctx.phase.step : "",
          busy: ctx.busy,
          error: ctx.error,
          canShowApp: ctx.canShowApp,
          revealed: ctx.revealedPasstoken?.username ?? "",
          biometryLabel: ctx.biometryLabel,
        }),
      () => setTick((t) => t + 1),
    );
  }, [ctx]);

  return ctx;
}

export type { AppSessionPhase, SessionRole };
