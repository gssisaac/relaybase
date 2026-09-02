"use client";

import * as React from "react";

import { AppSessionProvider } from "@/lib/desktop/app-session";
import { AppUpdaterProvider } from "@/lib/desktop/updater/AppUpdaterContext";

import { DesktopProvider } from "./DesktopContext";

/**
 * Single root client boundary for desktop + session state.
 *
 * Previously `DesktopProvider` was instantiated separately inside the shell
 * gate and the setup layout, so the two subtrees held independent sessions.
 * Lifting it here means every route (including `/` and `/login`) shares one
 * `DesktopContext` and one `AppSessionStore`, and the session-state machine
 * boots the moment the window opens — before any gate or unlock panel
 * mounts. Mail unlock is silent on boot; console Touch ID runs only at
 * dashboard entry (`ensureConsoleAccess` / `ConsoleGateView`).
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <DesktopProvider>
      <AppUpdaterProvider>
        <AppSessionProvider>{children}</AppSessionProvider>
      </AppUpdaterProvider>
    </DesktopProvider>
  );
}
