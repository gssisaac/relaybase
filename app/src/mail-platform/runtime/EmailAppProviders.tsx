/**
 * Email app providers — assembles the `MailRuntime` for email mode
 * (web-only mail client).
 *
 * This replaces `AppProviders` (DesktopProvider + AppSessionProvider) for
 * the `(email-app)` route group. No console, no Touch ID, no keyring —
 * just the mail session + transport + storage + platform.
 */
"use client";

import * as React from "react";
import { MailRuntimeProvider } from "./MailRuntimeContext";
import { createEmailSession } from "../session";
import { createEmailTransport } from "../transport";
import { createWebStorage } from "../storage";
import { createWebPlatform, createWebChrome } from "../shell";
import type { MailRuntime, MailFeatures } from "../types";

const EMAIL_FEATURES: MailFeatures = {
  console: false,
  multiAccount: false,
  enableEmailApiOnboarding: false,
};

export function EmailAppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  // Lazy-init the session store once; it survives re-renders.
  const [session] = React.useState(() => createEmailSession());

  const runtime = React.useMemo<MailRuntime>(() => {
    const transport = createEmailTransport({
      getIdentity: () => session.identity,
      getMobilePassword: () => session.mobilePassword,
    });
    return {
      transport,
      session,
      storage: createWebStorage(),
      platform: createWebPlatform(),
      chrome: createWebChrome(),
      features: EMAIL_FEATURES,
      accountScopeId: session.identity?.accountEmail ?? "",
    };
  }, [session]);

  return (
    <MailRuntimeProvider runtime={runtime}>
      {children}
    </MailRuntimeProvider>
  );
}
