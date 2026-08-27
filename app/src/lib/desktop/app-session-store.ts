"use client";

import { makeAutoObservable, runInAction } from "mobx";

import type {
  DesktopCredentials,
  DesktopTeamLogin,
  OwnerSessionStatus,
  TeamSessionStatus,
} from "./bridge";

/** Lazy-load the bridge so this module stays importable in the unit-test
 * runner (which cannot resolve the app's `@/` path alias or Tauri). The
 * production app always injects nothing, so these load on first use. */
async function bridge() {
  return await import("./bridge");
}

function defaultIsDesktop(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { __TAURI_INTERNALS__?: unknown };
  return Boolean(w.__TAURI_INTERNALS__);
}

/** Local copy of `biometryLabel` so this module does not pull in `biometry.ts`
 * (which imports the bridge and would break the unit-test runner). */
function biometryLabel(platform?: string): string {
  if (platform === "windows") return "Windows Hello";
  if (platform === "macos") return "Touch ID";
  return "device password";
}

/** Inlined `isUserDismissedBiometry` so this module has no runtime relative
 * imports (which the unit-test runner cannot resolve without extensions). */
const DISMISSED_BIOMETRY_CODES = new Set([
  "usercancel",
  "appcancel",
  "systemcancel",
  "userfallback",
]);
function normalizeDismissCode(value: string): string {
  return value.toLowerCase().replace(/[_\s-]/g, "");
}
function dismissedCode(value: string): boolean {
  const code = normalizeDismissCode(value);
  if (DISMISSED_BIOMETRY_CODES.has(code)) return true;
  return (
    code.endsWith("cancel") ||
    code.endsWith("cancelled") ||
    code.endsWith("canceled")
  );
}
function isDismissedBiometryMessage(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  const bracket = text.match(/^\[([^\]]+)\]/);
  if (bracket && dismissedCode(bracket[1])) return true;
  const lower = text.toLowerCase();
  if (
    lower.includes("usercancel") ||
    lower.includes("appcancel") ||
    lower.includes("systemcancel")
  ) {
    return true;
  }
  if (lower.includes("user fallback") || lower.includes("userfallback")) {
    return true;
  }
  return /authentication cancel+ed/.test(lower);
}
function isUserDismissedBiometry(err: unknown): boolean {
  if (err == null) return false;
  if (typeof err === "object") {
    const o = err as { errorCode?: unknown; code?: unknown; message?: unknown };
    const rawCode = o.errorCode ?? o.code;
    if (typeof rawCode === "string" && dismissedCode(rawCode)) return true;
    if (typeof o.message === "string" && isDismissedBiometryMessage(o.message)) {
      return true;
    }
  }
  if (err instanceof Error) return isDismissedBiometryMessage(err.message);
  if (typeof err === "string") return isDismissedBiometryMessage(err);
  return false;
}

/**
 * Single source of truth for "who can enter the app right now".
 *
 * Owner and invited (team) share the same machine:
 *   - Owner daily   = keyring refresh → Touch ID → owner_unlock
 *   - Invited daily = keyring mobile password → Touch ID → team_unlock
 *   - First invited login verifies the password, then offers biometry once.
 *     Accept stores the password in the OS keyring; decline leaves nothing
 *     on disk and the next run re-enters the password.
 */

export type AppSessionPhase =
  | { kind: "boot" }
  | { kind: "choice" }
  | {
      kind: "install";
      step: "oauth" | "progress" | "createOwner" | "revealPasstoken";
    }
  | { kind: "invitedLogin" }
  | { kind: "offerBiometry"; role: "invited" }
  | {
      kind: "unlock";
      role: "owner" | "invited";
      mode: "prompting" | "idle" | "secret";
    }
  | { kind: "invitedReady" }
  | { kind: "ownerReady" }
  | { kind: "ownerRecover" };

export type SessionRole = "none" | "owner" | "invited";

type IdentitySnapshot = {
  ready: boolean;
  isDesktop: boolean;
  credentials: DesktopCredentials | null;
  teamIdentity: DesktopTeamLogin | null;
};

/** Injectable bridge surface so the store is testable without Tauri. */
export type AppSessionDeps = {
  isDesktop: () => boolean;
  authenticateBiometry: (reason: string) => Promise<void>;
  ownerSessionStatus: () => Promise<OwnerSessionStatus>;
  ownerLogin: (input: {
    workerUrl: string;
    username: string;
    passtoken: string;
    biometryEnabled?: boolean;
  }) => Promise<OwnerSessionStatus>;
  ownerUnlock: () => Promise<OwnerSessionStatus>;
  ownerLogout: () => Promise<void>;
  ownerSetupAdmin: (input: {
    workerUrl: string;
    username: string;
    pepper: string;
  }) => Promise<{ username: string; passtoken: string }>;
  ownerResetAdmin: (input: {
    workerUrl: string;
    cfAccessToken: string;
    username?: string;
  }) => Promise<{ username: string; passtoken: string }>;
  teamSessionStatus: () => Promise<TeamSessionStatus>;
  teamLogin: (input: {
    workerUrl: string;
    accountEmail: string;
    mobilePassword: string;
    biometryEnabled?: boolean;
  }) => Promise<TeamSessionStatus>;
  teamUnlock: () => Promise<TeamSessionStatus>;
  teamLogout: () => Promise<void>;
  teamSetBiometryEnabled: (enabled: boolean) => Promise<TeamSessionStatus>;
};

function visibleUnlockError(err: unknown): string | null {
  if (isUserDismissedBiometry(err)) return null;
  const message = err instanceof Error ? err.message : String(err ?? "");
  if (!message.trim() || isUserDismissedBiometry(message)) return null;
  return message;
}

export class AppSessionStore {
  phase: AppSessionPhase = { kind: "boot" };
  ownerStatus: OwnerSessionStatus | null = null;
  teamStatus: TeamSessionStatus | null = null;
  error: string | null = null;
  revealedPasstoken: { username: string; passtoken: string } | null = null;
  busy = false;

  private identity: IdentitySnapshot = {
    ready: false,
    isDesktop: false,
    credentials: null,
    teamIdentity: null,
  };
  private statusesHydrated = false;
  private prompted = false;
  private deps: AppSessionDeps;

  constructor(deps?: Partial<AppSessionDeps>) {
    this.deps = {
      isDesktop: defaultIsDesktop,
      authenticateBiometry: (reason) =>
        import("./biometry").then((b) => b.desktopAuthenticateBiometry(reason)),
      ownerSessionStatus: () => bridge().then((b) => b.desktopOwnerSessionStatus()),
      ownerLogin: (input) => bridge().then((b) => b.desktopOwnerLogin(input)),
      ownerUnlock: () => bridge().then((b) => b.desktopOwnerUnlock()),
      ownerLogout: () => bridge().then((b) => b.desktopOwnerLogout()),
      ownerSetupAdmin: (input) => bridge().then((b) => b.desktopOwnerSetupAdmin(input)),
      ownerResetAdmin: (input) => bridge().then((b) => b.desktopOwnerResetAdmin(input)),
      teamSessionStatus: () => bridge().then((b) => b.desktopTeamSessionStatus()),
      teamLogin: (input) => bridge().then((b) => b.desktopTeamLogin(input)),
      teamUnlock: () => bridge().then((b) => b.desktopTeamUnlock()),
      teamLogout: () => bridge().then((b) => b.desktopTeamLogout()),
      teamSetBiometryEnabled: (enabled) =>
        bridge().then((b) => b.desktopTeamSetBiometryEnabled(enabled)),
      ...deps,
    };
    makeAutoObservable(
      this,
      { deps: false } as unknown as never,
      { autoBind: true },
    );
  }

  // --- Derived ---

  get role(): SessionRole {
    switch (this.phase.kind) {
      case "invitedReady":
      case "offerBiometry":
      case "invitedLogin":
        return "invited";
      case "ownerReady":
      case "ownerRecover":
        return "owner";
      case "unlock":
        return this.phase.role;
      default:
        return "none";
    }
  }

  get canShowApp(): boolean {
    return this.phase.kind === "ownerReady" || this.phase.kind === "invitedReady";
  }

  get needsUnlockPrompt(): boolean {
    return (
      this.phase.kind === "unlock" && this.phase.mode === "prompting"
    );
  }

  get biometryLabel(): string {
    const platform =
      this.role === "invited"
        ? (this.teamStatus?.platform ?? "macos")
        : (this.ownerStatus?.platform ?? "macos");
    return biometryLabel(platform);
  }

  // --- Hydration ---

  /** Push the latest owner/team keyring status. Triggers an immediate
   * biometric prompt when a keyring secret exists and there is no access. */
  setStatuses(owner: OwnerSessionStatus, team: TeamSessionStatus): void {
    this.ownerStatus = owner;
    this.teamStatus = team;
    this.statusesHydrated = true;
    this.reconcileFromStatuses();
  }

  /** Push the latest identity snapshot from DesktopContext. Resolves the
   * non-prompt branches (choice / invitedLogin / owner secret form). */
  setIdentity(snapshot: IdentitySnapshot): void {
    this.identity = snapshot;
    if (snapshot.ready && this.phase.kind === "boot") {
      this.reconcileFromStatuses();
    }
  }

  private reconcileFromStatuses(): void {
    if (!this.statusesHydrated) return;
    const team = this.teamStatus;
    const owner = this.ownerStatus;

    // Invited takes precedence — a teammate never holds owner credentials.
    if (this.identity.teamIdentity || (team && team.hasSecret)) {
      if (team?.hasAccess) {
        this.phase = { kind: "invitedReady" };
        return;
      }
      if (team?.hasSecret) {
        this.phase = {
          kind: "unlock",
          role: "invited",
          mode: "prompting",
        };
        this.maybeAutoPrompt();
        return;
      }
      // Identity present but no keyring secret yet → first-time invited login.
      if (this.identity.ready) {
        this.phase = { kind: "invitedLogin" };
      }
      return;
    }

    if (owner?.hasAccess) {
      this.phase = { kind: "ownerReady" };
      return;
    }
    if (owner?.hasRefresh) {
      this.phase = { kind: "unlock", role: "owner", mode: "prompting" };
      this.maybeAutoPrompt();
      return;
    }

    // No keyring secret. Decide between owner secret form and the welcome
    // choice once identity (credentials.workerUrl) is available.
    if (!this.identity.ready) {
      // Stay in boot until identity arrives.
      if (this.phase.kind !== "boot") this.phase = { kind: "boot" };
      return;
    }
    const workerUrl = this.identity.credentials?.workerUrl?.trim() ?? "";
    if (workerUrl) {
      this.phase = { kind: "unlock", role: "owner", mode: "secret" };
    } else {
      this.phase = { kind: "choice" };
    }
  }

  private maybeAutoPrompt(): void {
    if (this.prompted) return;
    if (this.phase.kind !== "unlock" || this.phase.mode !== "prompting") return;
    this.prompted = true;
    void this.promptUnlock();
  }

  // --- Actions ---

  /** Trigger Touch ID / Windows Hello, then unlock the active role. */
  async promptUnlock(): Promise<void> {
    if (this.phase.kind !== "unlock") return;
    const role = this.phase.role;
    if (this.phase.mode !== "prompting") {
      runInAction(() => {
        this.phase = { kind: "unlock", role, mode: "prompting" };
      });
    }
    this.busy = true;
    this.error = null;
    try {
      const reason =
        role === "invited"
          ? "Unlock your Relaybase team session"
          : "Unlock your Relaybase owner session";
      if (this.deps.isDesktop()) {
        await this.deps.authenticateBiometry(reason);
      }
      if (role === "invited") {
        await this.deps.teamUnlock();
      } else {
        await this.deps.ownerUnlock();
      }
      runInAction(() => {
        this.phase = { kind: role === "invited" ? "invitedReady" : "ownerReady" };
        this.busy = false;
      });
    } catch (err) {
      const shown = visibleUnlockError(err);
      runInAction(() => {
        this.error = shown;
        this.phase = { kind: "unlock", role, mode: "idle" };
        this.busy = false;
      });
      // If the keyring secret vanished (refresh revoked), fall back to the
      // secret form so the user can re-authenticate.
      try {
        if (role === "invited") {
          const status = await this.deps.teamSessionStatus();
          runInAction(() => {
            this.teamStatus = status;
            if (!status.hasSecret) {
              this.phase = { kind: "unlock", role, mode: "idle" };
            }
          });
        } else {
          const status = await this.deps.ownerSessionStatus();
          runInAction(() => {
            this.ownerStatus = status;
            if (!status.hasRefresh) {
              this.phase = { kind: "unlock", role, mode: "secret" };
            }
          });
        }
      } catch {
        /* keep idle */
      }
    }
  }

  /** Switch the unlock view to the secret (passtoken / password) form. */
  showSecretForm(): void {
    if (this.phase.kind !== "unlock") return;
    this.phase = { kind: "unlock", role: this.phase.role, mode: "secret" };
    this.error = null;
  }

  /** Switch the unlock view back to the biometric prompt (or stay secret if
   * there is no keyring secret to prompt against). */
  requestPrompt(): void {
    if (this.phase.kind !== "unlock") return;
    const role = this.phase.role;
    const hasKeyringSecret =
      role === "invited"
        ? Boolean(this.teamStatus?.hasSecret)
        : Boolean(this.ownerStatus?.hasRefresh);
    if (!hasKeyringSecret) {
      this.phase = { kind: "unlock", role, mode: "secret" };
      return;
    }
    this.error = null;
    void this.promptUnlock();
  }

  /** Owner: exchange username + passtoken for a session. */
  async loginWithPasstoken(input: {
    workerUrl: string;
    username: string;
    passtoken: string;
  }): Promise<void> {
    this.busy = true;
    this.error = null;
    try {
      const status = await this.deps.ownerLogin({
        workerUrl: input.workerUrl,
        username: input.username,
        passtoken: input.passtoken,
      });
      runInAction(() => {
        this.ownerStatus = status;
        this.phase = { kind: "ownerReady" };
        this.busy = false;
      });
    } catch (err) {
      const shown = visibleUnlockError(err) ?? "Sign in failed.";
      runInAction(() => {
        this.error = shown;
        this.busy = false;
      });
      throw err;
    }
  }

  /** Invited: verify the mobile password and store it in the keyring. */
  async loginInvited(input: {
    workerUrl: string;
    accountEmail: string;
    mobilePassword: string;
  }): Promise<void> {
    this.busy = true;
    this.error = null;
    try {
      const status = await this.deps.teamLogin({
        workerUrl: input.workerUrl,
        accountEmail: input.accountEmail,
        mobilePassword: input.mobilePassword,
      });
      runInAction(() => {
        this.teamStatus = status;
        this.busy = false;
      });
      // First login: offer biometry once (desktop with biometry only).
      if (this.deps.isDesktop() && status.platform !== "linux") {
        runInAction(() => {
          this.phase = { kind: "offerBiometry", role: "invited" };
        });
      } else {
        runInAction(() => {
          this.phase = { kind: "invitedReady" };
        });
      }
    } catch (err) {
      const shown = visibleUnlockError(err) ?? "Team login failed.";
      runInAction(() => {
        this.error = shown;
        this.busy = false;
      });
      throw err;
    }
  }

  /** Invited accepted biometry: enable it on the keyring and enter the app. */
  async acceptBiometry(): Promise<void> {
    if (this.phase.kind !== "offerBiometry") return;
    this.busy = true;
    try {
      const status = await this.deps.teamSetBiometryEnabled(true);
      runInAction(() => {
        this.teamStatus = status;
        this.phase = { kind: "invitedReady" };
        this.busy = false;
      });
    } catch (err) {
      runInAction(() => {
        this.error = visibleUnlockError(err) ?? "Could not enable biometry.";
        this.busy = false;
      });
    }
  }

  /** Invited declined biometry: disable it and still enter the app this run. */
  async declineBiometry(): Promise<void> {
    if (this.phase.kind !== "offerBiometry") return;
    this.busy = true;
    try {
      const status = await this.deps.teamSetBiometryEnabled(false);
      runInAction(() => {
        this.teamStatus = status;
        this.phase = { kind: "invitedReady" };
        this.busy = false;
      });
    } catch {
      runInAction(() => {
        this.phase = { kind: "invitedReady" };
        this.busy = false;
      });
    }
  }

  /** Sign out the active role and return to the welcome choice. */
  async signOut(): Promise<void> {
    this.busy = true;
    try {
      if (this.role === "invited") {
        await this.deps.teamLogout();
      } else if (this.role === "owner") {
        await this.deps.ownerLogout();
      }
    } catch {
      /* best-effort */
    }
    runInAction(() => {
      this.ownerStatus = null;
      this.teamStatus = null;
      this.error = null;
      this.revealedPasstoken = null;
      this.prompted = false;
      this.statusesHydrated = false;
      this.phase = { kind: "choice" };
      this.busy = false;
    });
  }

  /** Owner forgot passtoken: enter the recover view (CF access token reset). */
  enterRecover(): void {
    this.phase = { kind: "ownerRecover" };
    this.error = null;
  }

  /** Owner recover: reset the admin passtoken via a CF access token. */
  async recoverOwner(input: {
    workerUrl: string;
    cfAccessToken: string;
    username?: string;
  }): Promise<void> {
    this.busy = true;
    this.error = null;
    try {
      const result = await this.deps.ownerResetAdmin({
        workerUrl: input.workerUrl,
        cfAccessToken: input.cfAccessToken,
        username: input.username,
      });
      runInAction(() => {
        this.revealedPasstoken = {
          username: result.username,
          passtoken: result.passtoken,
        };
        this.phase = { kind: "install", step: "revealPasstoken" };
        this.busy = false;
      });
    } catch (err) {
      runInAction(() => {
        this.error = visibleUnlockError(err) ?? "Reset failed.";
        this.busy = false;
      });
      throw err;
    }
  }

  /** Install finish: create the owner with the bootstrap pepper. */
  async createOwner(input: {
    workerUrl: string;
    username: string;
    pepper: string;
  }): Promise<void> {
    this.busy = true;
    this.error = null;
    try {
      const result = await this.deps.ownerSetupAdmin({
        workerUrl: input.workerUrl,
        username: input.username,
        pepper: input.pepper,
      });
      runInAction(() => {
        this.revealedPasstoken = {
          username: result.username,
          passtoken: result.passtoken,
        };
        this.phase = { kind: "install", step: "revealPasstoken" };
        this.busy = false;
      });
    } catch (err) {
      runInAction(() => {
        this.error = visibleUnlockError(err) ?? "Could not set up owner.";
        this.busy = false;
      });
      throw err;
    }
  }

  /** After revealing the passtoken, the user copies it and logs in. */
  consumeRevealedPasstoken(): void {
    this.revealedPasstoken = null;
    runInAction(() => {
      this.phase = { kind: "unlock", role: "owner", mode: "secret" };
    });
  }

  clearError(): void {
    this.error = null;
  }
}
