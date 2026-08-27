"use client";

import * as React from "react";

import { DesktopProvider } from "@/lib/desktop/DesktopContext";
import { AppSessionProvider } from "@/lib/app-session";

/**
 * Single root client boundary for desktop + session state.
 *
 * Previously `DesktopProvider` was instantiated separately inside the shell
 * gate and the setup layout, so the two subtrees held independent sessions.
 * Lifting it here means every route (including `/` and `/login`) shares one
 * `DesktopContext` and one `AppSessionStore`, and the session-state machine
 * boots the moment the window opens — before any gate or unlock panel
 * mounts. That is what makes Touch ID appear instantly on launch.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <DesktopProvider>
      <AppSessionProvider>{children}</AppSessionProvider>
    </DesktopProvider>
  );
}
