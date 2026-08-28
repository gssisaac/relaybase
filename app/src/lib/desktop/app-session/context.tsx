"use client";

import * as React from "react";
import { reaction } from "mobx";

import {
  desktopOwnerSessionStatus,
  desktopTeamSessionStatus,
  isDesktopRuntime,
  type OwnerSessionStatus,
  type TeamSessionStatus,
} from "@/lib/desktop/bridge";
import { useDesktop } from "@/lib/desktop/shell";

import { createDefaultDeps } from "./defaults";
import { AppSessionStore } from "./store";
import type { AppSessionPhase, SessionRole } from "./types";

const EMPTY_OWNER: OwnerSessionStatus = {
  hasMailRefresh: false,
  hasConsoleRefresh: false,
  hasMailAccess: false,
  hasConsoleAccess: false,
  hasRefresh: false,
  hasAccess: false,
  username: "",
  workerUrl: "",
  platform: "macos",
};

const EMPTY_TEAM: TeamSessionStatus = {
  hasSecret: false,
  hasAccess: false,
  accountEmail: "",
  workerUrl: "",
  platform: "macos",
};

async function waitForDesktopRuntime(timeoutMs: number): Promise<boolean> {
  if (isDesktopRuntime()) return true;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 40));
    if (isDesktopRuntime()) return true;
  }
  return isDesktopRuntime();
}

async function readStatusWithRetry<T>(
  read: () => Promise<T>,
  fallback: T,
  isReal: (value: T) => boolean,
): Promise<T> {
  let latest = fallback;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      latest = await read();
      if (isReal(latest)) return latest;
    } catch {
      /* retry — unsigned `tauri dev` / late invoke often throw once */
    }
    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 80 * (attempt + 1)));
    }
  }
  return latest;
}

const AppSessionContext = React.createContext<AppSessionStore | null>(null);

/**
 * Wires `AppSessionStore` to `DesktopContext`. Boot fetches owner + team
 * keyring status in parallel, then runs silent mail boot unlock (no Touch ID).
 */
export function AppSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const desktop = useDesktop();
  const desktopRef = React.useRef(desktop);
  desktopRef.current = desktop;
  const storeRef = React.useRef<AppSessionStore | null>(null);

  const [store] = React.useState(() => {
    const instance = new AppSessionStore(
      createDefaultDeps({
        refreshIdentity: async () => {
          const snap = await desktopRef.current.refresh();
          storeRef.current?.setIdentity({
            ready: true,
            isDesktop: isDesktopRuntime(),
            credentials: snap.credentials,
            teamIdentity: snap.teamLogin,
          });
        },
      }),
    );
    storeRef.current = instance;
    return instance;
  });

  // Fetch owner + team keyring status after credentials are loaded.
  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const desktopNow = isDesktopRuntime();
      if (!desktopNow && !desktop.isDesktop) {
        store.setStatuses(EMPTY_OWNER, EMPTY_TEAM);
        return;
      }
      if (!desktopNow) {
        const ready = await waitForDesktopRuntime(2_500);
        if (cancelled) return;
        if (!ready) {
          store.setStatuses(EMPTY_OWNER, EMPTY_TEAM);
          return;
        }
      }
      const snap = await desktop.refresh();
      if (cancelled) return;
      store.setIdentity({
        ready: true,
        isDesktop: isDesktopRuntime(),
        credentials: snap.credentials,
        teamIdentity: snap.teamLogin,
      });
      const [ownerStatus, teamStatus] = await Promise.all([
        readStatusWithRetry(desktopOwnerSessionStatus, EMPTY_OWNER, (s) =>
          Boolean(
            s.hasMailRefresh ||
              s.hasConsoleRefresh ||
              s.hasRefresh ||
              s.hasAccess,
          ),
        ),
        readStatusWithRetry(desktopTeamSessionStatus, EMPTY_TEAM, (s) =>
          Boolean(s.hasSecret || s.hasAccess),
        ),
      ]);
      if (cancelled) return;
      store.setStatuses(ownerStatus, teamStatus);
    })();
    return () => {
      cancelled = true;
    };
  }, [store, desktop.isDesktop, desktop.refresh]);

  // Mirror DesktopContext identity into the store so non-prompt phases
  // (choice / invitedLogin / owner UnlockView) resolve once ready.
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

  // Mail 401 → silent mail refresh; console 401 → dashboard gate.
  React.useEffect(() => {
    function onMailUnauthorized() {
      void store.handleWorkerUnauthorized();
    }
    function onConsoleUnauthorized() {
      void store.handleConsoleUnauthorized();
    }
    window.addEventListener("relaybase:unauthorized", onMailUnauthorized);
    window.addEventListener(
      "relaybase:console-unauthorized",
      onConsoleUnauthorized,
    );
    return () => {
      window.removeEventListener("relaybase:unauthorized", onMailUnauthorized);
      window.removeEventListener(
        "relaybase:console-unauthorized",
        onConsoleUnauthorized,
      );
    };
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
          role: ctx.phase.kind === "unlock" ? ctx.phase.role : "",
          step: ctx.phase.kind === "install" ? ctx.phase.step : "",
          busy: ctx.busy,
          error: ctx.error,
          canShowApp: ctx.canShowApp,
          consoleGateOpen: ctx.consoleGateOpen,
          hasConsoleAccess: ctx.hasConsoleAccess,
          workerUrl: ctx.ownerStatus?.workerUrl ?? "",
          hasRefresh: Boolean(ctx.ownerStatus?.hasRefresh),
          hasSecret: Boolean(ctx.teamStatus?.hasSecret),
          revealed: ctx.revealedPasstoken?.username ?? "",
        }),
      () => setTick((t) => t + 1),
    );
  }, [ctx]);

  return ctx;
}

export type { AppSessionPhase, SessionRole };
