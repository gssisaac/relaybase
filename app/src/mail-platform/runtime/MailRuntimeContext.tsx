/**
 * Mail runtime context — the single entry point email UI uses.
 *
 * Replaces `useDesktop`, `useAppSession`, `desktopAwareFetch`, and the
 * storage bridge calls with one `useMailRuntime()` hook. The runtime
 * is assembled by `EmailAppProviders` (email mode) or `AppProviders`
 * (console mode) at the root layout.
 */
"use client";

import * as React from "react";
import type { MailRuntime } from "../types";

const MailRuntimeContext = React.createContext<MailRuntime | null>(null);

export function MailRuntimeProvider({
  runtime,
  children,
}: {
  runtime: MailRuntime;
  children: React.ReactNode;
}) {
  return (
    <MailRuntimeContext.Provider value={runtime}>
      {children}
    </MailRuntimeContext.Provider>
  );
}

export function useMailRuntime(): MailRuntime {
  const ctx = React.useContext(MailRuntimeContext);
  if (!ctx) {
    throw new Error("useMailRuntime requires MailRuntimeProvider");
  }
  return ctx;
}

export function useOptionalMailRuntime(): MailRuntime | null {
  return React.useContext(MailRuntimeContext);
}
