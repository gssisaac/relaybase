/**
 * Desktop session adapter — implements `AuthSession` for the desktop build.
 *
 * Console mode (desktop app) authenticates via the OS keyring + Touch ID
 * through `DesktopProvider` / `AppSessionStore`. This adapter exposes the
 * unified `AuthSession` port so email UI code stays platform-agnostic.
 *
 * The owner's worker URL comes from `DesktopCredentials`; the "identity"
 * here is the owner (or the invited teammate when `teamLogin` is set).
 * Login/logout are handled by the existing desktop flows (Touch ID /
 * team login dialog), so `login()` throws and `logout()` delegates to
 * `AppSessionStore.signOut()`.
 */
import { useDesktop } from "@/lib/desktop/shell";
import { isDesktopRuntime } from "@/lib/desktop/bridge";
import type { AuthSession, EmailIdentity, SessionRole } from "../types";
import { useMemo } from "react";

export type ConsoleSessionAdapter = AuthSession & {
  /** The underlying DesktopContext value (for components still reading it). */
  desktopReady: boolean;
};

/**
 * Build an `AuthSession` from the existing `DesktopContext`.
 *
 * In console mode the "identity" is derived from credentials (owner) or
 * teamLogin (invited teammate). Login/logout are handled by the existing
 * `AppSessionStore` flows (Touch ID / team login dialog), so this adapter
 * forwards those calls to the bridge rather than implementing its own.
 */
export function useConsoleSession(): ConsoleSessionAdapter {
  const desktop = useDesktop();

  return useMemo<ConsoleSessionAdapter>(() => {
    const teamLogin = desktop.teamLogin;
    const creds = desktop.credentials;
    const identity: EmailIdentity | null = teamLogin
      ? {
          workerUrl: teamLogin.workerUrl,
          accountEmail: teamLogin.accountEmail,
        }
      : creds?.workerUrl
        ? {
            workerUrl: creds.workerUrl,
            accountEmail: creds.relaybaseEmail || "",
          }
        : null;

    const role: SessionRole = teamLogin ? "team" : "owner";
    const isTeamMode = Boolean(teamLogin);

    return {
      role,
      isDesktop: true,
      isTeamMode,
      ready: desktop.ready,
      identity,
      accountEmail: identity?.accountEmail ?? "",
      workerUrl: identity?.workerUrl ?? "",
      accountScopeId: desktop.accountScopeId,
      mobilePassword: teamLogin?.mobilePassword ?? null,
      getAuthHeaders() {
        const headers: Record<string, string> = {};
        if (teamLogin?.mobilePassword) {
          headers.Authorization = `Bearer ${teamLogin.mobilePassword}`;
        }
        if (teamLogin?.accountEmail) {
          headers["X-Account-Email"] = teamLogin.accountEmail;
        }
        return headers;
      },
      async login() {
        // Console login is handled by AppSessionStore (Touch ID / team dialog).
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
