"use client";

import { makeAutoObservable, runInAction } from "mobx";

import { biometryLabel } from "../biometry/label";
import type { OwnerSessionStatus, TeamSessionStatus } from "../desktop/bridge";
import { createDefaultDeps } from "./defaults";
import { visibleUnlockError } from "./errors";
import type {
  AppSessionDeps,
  AppSessionPhase,
  IdentitySnapshot,
  SessionRole,
} from "./types";

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
    this.deps = createDefaultDeps(deps);
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
    return biometryLabel(0, platform);
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

  /**
   * Worker returned 401. Do NOT wipe the worker URL or keyring — the refresh
   * may simply be stale. Re-fetch keyring status and re-prompt unlock (or
   * fall back to the secret form if the refresh was revoked). The user stays
   * in place instead of being bounced to /setup.
   */
  async handleWorkerUnauthorized(): Promise<void> {
    this.prompted = false;
    try {
      const [owner, team] = await Promise.all([
        this.deps.ownerSessionStatus(),
        this.deps.teamSessionStatus(),
      ]);
      runInAction(() => {
        this.ownerStatus = owner;
        this.teamStatus = team;
        this.statusesHydrated = true;
      });
      this.reconcileFromStatuses();
      if (this.phase.kind === "unlock" && this.phase.mode === "prompting") {
        void this.promptUnlock();
      }
    } catch {
      /* keep current phase */
    }
  }
}
