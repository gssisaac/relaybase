/**
 * Web console app providers — assembles the `MailRuntime` for a web owner
 * with full dashboard access (console mode running in a browser tab, no
 * Tauri/keyring).
 *
 * Mirrors `ConsoleAppProviders` but swaps every desktop-only adapter for its
 * web counterpart. `createConsoleTransport()` (desktopAwareFetch ->
 * workerFetch) already branches on `isDesktopRuntime()` internally and has a
 * working Bearer-token path for web, so it is reused as-is.
 */
"use client";

import * as React from "react";
import { MailRuntimeProvider } from "./MailRuntimeContext";
import { createWebOwnerSession } from "../session/web-owner-session";
import { createConsoleTransport } from "../transport";
import { createWebStorage } from "../storage";
import { createWebPlatform, createWebChrome } from "../shell";
import type { MailRuntime, MailFeatures } from "../types";

const WEB_CONSOLE_FEATURES: MailFeatures = {
  console: true,
  multiAccount: true,
  enableEmailApiOnboarding: true,
};

export function WebConsoleAppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session] = React.useState(() => createWebOwnerSession());

  const runtime = React.useMemo<MailRuntime>(() => {
    const transport = createConsoleTransport();
    return {
      session,
      transport,
      storage: createWebStorage(),
      platform: createWebPlatform(),
      chrome: createWebChrome(),
      features: WEB_CONSOLE_FEATURES,
      accountScopeId: session.accountScopeId,
    };
  }, [session]);

  return (
    <MailRuntimeProvider runtime={runtime}>{children}</MailRuntimeProvider>
  );
}
