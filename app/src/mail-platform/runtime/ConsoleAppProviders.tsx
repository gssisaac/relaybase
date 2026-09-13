/**
 * Console app providers — assembles the `MailRuntime` for console mode
 * (desktop app with owner dashboard).
 *
 * Wraps the existing `AppProviders` tree with a `MailRuntimeProvider` so
 * email UI code can use the same `useMailRuntime()` hook in both builds.
 * The session delegates to `DesktopContext` / `AppSessionStore` via
 * `useConsoleSession()`; the transport delegates to `desktopAwareFetch`.
 */
"use client";

import * as React from "react";
import { MailRuntimeProvider } from "./MailRuntimeContext";
import { useConsoleSession } from "../session";
import { createConsoleTransport } from "../transport";
import { createDesktopStorage } from "../storage";
import { createDesktopPlatform, useDesktopChromeAdapter } from "../shell";
import type { MailRuntime, MailFeatures } from "../types";

const CONSOLE_FEATURES: MailFeatures = {
  console: true,
  multiAccount: true,
  enableEmailApiOnboarding: true,
};

export function ConsoleAppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = useConsoleSession();
  const chrome = useDesktopChromeAdapter();

  const runtime = React.useMemo<MailRuntime>(() => {
    const transport = createConsoleTransport();
    return {
      session,
      transport,
      storage: createDesktopStorage(),
      platform: createDesktopPlatform(),
      chrome,
      features: CONSOLE_FEATURES,
      accountScopeId: session.accountScopeId,
    };
  }, [session, chrome]);

  return (
    <MailRuntimeProvider runtime={runtime}>
      {children}
    </MailRuntimeProvider>
  );
}
