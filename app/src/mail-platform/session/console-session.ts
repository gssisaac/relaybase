/**
 * Console-mode session — delegates to the existing `DesktopProvider` /
 * `AppSessionStore`.
 *
 * Console mode (desktop app) authenticates via the OS keyring + Touch ID.
 * This adapter exposes the `MailSession` port surface so email UI code
 * can stay platform-agnostic. The owner's worker URL comes from
 * `DesktopCredentials`; the "identity" here is the owner, not a teammate.
 */
import { useDesktop } from "@/lib/desktop/shell";
import { isDesktopRuntime } from "@/lib/desktop/bridge";
import type { MailSession, EmailIdentity } from "../types";
import { useMemo } from "react";

export type ConsoleSessionAdapter = MailSession & {
  /** The underlying DesktopContext value (for components still reading it). */
  desktopReady: boolean;
  accountScopeId: string;
};

/**
 * Build a `MailSession` from the existing `DesktopContext`.
 *
 * In console mode the "identity" is derived from credentials (owner) or
 * teamLogin (invited teammate). Login/logout are handled by the existing
 * `AppSessionStore` flows (Touch ID / team login dialog), so this adapter
 * forwards those calls to the bridge rather than implementing its own.
 */
export function useConsoleSession(): ConsoleSessionAdapter {
  const desktop = useDesktop();

  return useMemo<ConsoleSessionAdapter>(() => {
    const identity: EmailIdentity | null = desktop.teamLogin
      ? {
          workerUrl: desktop.teamLogin.workerUrl,
          accountEmail: desktop.teamLogin.accountEmail,
        }
      : desktop.credentials?.workerUrl
        ? {
            workerUrl: desktop.credentials.workerUrl,
            accountEmail: desktop.credentials.relaybaseEmail || "",
          }
        : null;

    return {
      ready: desktop.ready,
      identity,
      async login() {
        // Console login is handled by AppSessionStore (Touch ID / team dialog).
        // This is a no-op stub; components that need login use the existing
        // UnlockView / AddTeamAccountDialog directly.
        throw new Error("Console login is handled by the desktop session UI.");
      },
      async logout() {
        // Delegated to AppSessionStore.signOut() via existing UI.
      },
      subscribe(_listener: () => void): () => void {
        void _listener;
        // DesktopContext re-renders on credential changes; React handles
        // subscription. For non-React callers, return a no-op.
        return () => {};
      },
      get desktopReady() {
        return desktop.ready;
      },
      get accountScopeId() {
        return desktop.accountScopeId;
      },
    };
  }, [
    desktop.ready,
    desktop.credentials?.workerUrl,
    desktop.credentials?.relaybaseEmail,
    desktop.teamLogin,
    desktop.accountScopeId,
  ]);
}

export { isDesktopRuntime };
