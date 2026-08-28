"use client";

import { makeAutoObservable, runInAction } from "mobx";

import { isSystemCanceledBiometry } from "../biometry/dismiss";
import { biometryLabel } from "../biometry/label";
import type { OwnerSessionStatus, TeamSessionStatus } from "../bridge";
import { createDefaultDeps } from "./defaults";
import { visibleUnlockError } from "./errors";
import { resolveWorkerUrl } from "./resolve-worker-url";
import {
  isValidPasstokenFormat,
  normalizePasstokenInput,
  passtokenFormatHint,
} from "../worker-url/normalize-passtoken";
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
      case "invitedLogin":
        return "invited";
      case "offerBiometry":
        return this.phase.role;
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
    if (this.phase.kind !== "ownerReady" && this.phase.kind !== "invitedReady") {
      return false;
    }
    return this.hasWorkerConnected();
  }

  /** Worker URL: keyring first, then disk identity files. */
  private hasWorkerConnected(): boolean {
    const role = this.role;
    if (role === "invited") {
      return Boolean(this.resolvedWorkerUrl("invited"));
    }
    if (role === "owner") {
      return Boolean(this.resolvedWorkerUrl("owner"));
    }
    return Boolean(
      this.resolvedWorkerUrl("owner") || this.resolvedWorkerUrl("invited"),
    );
  }

  private resolvedWorkerUrl(role: "owner" | "invited"): string {
    return resolveWorkerUrl({
      role,
      ownerStatus: this.ownerStatus,
      teamStatus: this.teamStatus,
      credentials: this.identity.credentials,
      teamLogin: this.identity.teamIdentity,
    });
  }

  private hasKeyringUnlock(role: "owner" | "invited"): boolean {
    return role === "invited"
      ? Boolean(this.teamStatus?.hasSecret)
      : Boolean(this.ownerStatus?.hasRefresh);
  }

  /** User opted into auto Touch ID / Windows Hello on launch. */
  private wantsBiometryUnlock(role: "owner" | "invited"): boolean {
    if (role === "owner") {
      return Boolean(
        this.ownerStatus?.hasRefresh && this.ownerStatus?.biometryEnabled,
      );
    }
    return Boolean(
      this.teamStatus?.hasSecret && this.teamStatus?.biometryEnabled,
    );
  }

  /** Touch ID surface when a keyring secret exists; passtoken form otherwise. */
  private unlockSurfaceMode(role: "owner" | "invited"): "idle" | "secret" {
    return this.hasKeyringUnlock(role) ? "idle" : "secret";
  }

  private enterUnlockForRole(role: "owner" | "invited"): void {
    if (!this.hasKeyringUnlock(role)) return;
    if (this.wantsBiometryUnlock(role)) {
      this.phase = { kind: "unlock", role, mode: "prompting" };
      this.prompted = false;
      this.maybeAutoPrompt();
      return;
    }
    this.phase = { kind: "unlock", role, mode: "idle" };
  }

  private isNoSavedSessionError(message: string | null): boolean {
    return Boolean(message?.includes("No saved session"));
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
   * non-prompt branches (choice / invitedLogin / owner unlock). */
  setIdentity(snapshot: IdentitySnapshot): void {
    this.identity = snapshot;
    if (snapshot.ready) {
      this.reconcileFromStatuses();
    }
    // Late Tauri inject: statuses already said "prompt" but invoke was missing.
    this.maybeAutoPrompt();
  }

  private reconcileFromStatuses(): void {
    const team = this.teamStatus;
    const owner = this.ownerStatus;

    if (
      this.phase.kind === "install" ||
      this.phase.kind === "ownerRecover" ||
      this.phase.kind === "offerBiometry"
    ) {
      return;
    }

    // Explicit invited login from the welcome /login trampoline — keep until
    // the user verifies or a keyring secret appears.
    if (this.phase.kind === "invitedLogin") {
      if (team?.hasAccess) {
        this.phase = this.hasWorkerConnected()
          ? { kind: "invitedReady" }
          : this.phase;
        return;
      }
      if (team?.hasSecret) {
        this.enterUnlockForRole("invited");
      }
      return;
    }

    // A late empty hydrate must not kick an already-unlocked session back
    // to UnlockView / the passtoken form.
    if (this.phase.kind === "ownerReady") {
      if (owner?.hasAccess && this.hasWorkerConnected()) return;
      if (owner?.hasAccess && this.identity.ready) {
        this.phase = { kind: "choice" };
        return;
      }
      if (owner?.hasRefresh) {
        this.enterUnlockForRole("owner");
      }
      return;
    }
    if (this.phase.kind === "invitedReady") {
      if (team?.hasAccess && this.hasWorkerConnected()) return;
      if (team?.hasAccess && this.identity.ready) {
        this.phase = { kind: "invitedLogin" };
        return;
      }
      if (team?.hasSecret) {
        this.enterUnlockForRole("invited");
      }
      return;
    }

    // Invited takes precedence — a teammate never holds owner credentials.
    if (this.identity.teamIdentity || (team && team.hasSecret)) {
      if (team?.hasAccess) {
        this.phase = this.hasWorkerConnected()
          ? { kind: "invitedReady" }
          : this.identity.ready
            ? { kind: "invitedLogin" }
            : this.phase;
        return;
      }
      if (team?.hasSecret) {
        this.enterUnlockForRole("invited");
        return;
      }
      // Identity present but no keyring secret yet → first-time invited login.
      if (this.identity.ready) {
        this.phase = { kind: "invitedLogin" };
      }
      return;
    }

    if (owner?.hasAccess) {
      if (this.hasWorkerConnected()) {
        this.phase = { kind: "ownerReady" };
      } else if (this.identity.ready) {
        this.phase = { kind: "choice" };
      }
      return;
    }
    if (owner?.hasRefresh) {
      this.enterUnlockForRole("owner");
      return;
    }

    // No keyring refresh → passtoken / mobile-password form (not Touch ID idle).
    if (!this.identity.ready) {
      if (this.phase.kind !== "boot") this.phase = { kind: "boot" };
      return;
    }
    if (this.resolvedWorkerUrl("owner")) {
      this.phase = {
        kind: "unlock",
        role: "owner",
        mode: this.unlockSurfaceMode("owner"),
      };
      return;
    }
    if (!this.statusesHydrated) {
      if (this.phase.kind !== "boot") this.phase = { kind: "boot" };
      return;
    }
    // Keep explicit unlock (Already installed / invited trampoline / secret fallback).
    if (
      this.phase.kind === "unlock" &&
      (this.phase.mode === "idle" || this.phase.mode === "secret")
    ) {
      return;
    }
    this.phase = { kind: "choice" };
  }

  private maybeAutoPrompt(): void {
    if (this.prompted) return;
    if (this.phase.kind !== "unlock" || this.phase.mode !== "prompting") return;
    // Don't consume the one-shot before Tauri invoke exists — a late
    // `__TAURI_INTERNALS__` inject used to skip Touch ID forever.
    if (!this.deps.isDesktop()) return;
    this.prompted = true;
    void this.promptUnlock();
  }

  // --- Actions ---

  private async authenticateBiometry(reason: string): Promise<void> {
    try {
      await this.deps.authenticateBiometry(reason);
    } catch (err) {
      // Window not key yet → macOS replies systemCancel. Retry once.
      if (!isSystemCanceledBiometry(err)) throw err;
      await new Promise((r) => setTimeout(r, 200));
      await this.deps.authenticateBiometry(reason);
    }
  }

  private async enterAppAfterUnlock(
    role: "owner" | "invited",
    status: OwnerSessionStatus | TeamSessionStatus,
  ): Promise<void> {
    if (role === "invited") {
      runInAction(() => {
        this.teamStatus = status as TeamSessionStatus;
      });
    } else {
      runInAction(() => {
        this.ownerStatus = status as OwnerSessionStatus;
      });
    }
    await this.deps.refreshIdentity();
    runInAction(() => {
      if (role === "invited") {
        this.phase = this.hasWorkerConnected()
          ? { kind: "invitedReady" }
          : { kind: "invitedLogin" };
      } else {
        this.phase = this.hasWorkerConnected()
          ? { kind: "ownerReady" }
          : { kind: "choice" };
      }
      this.busy = false;
    });
  }

  /** Trigger Touch ID / Windows Hello, then unlock the active role. */
  async promptUnlock(): Promise<void> {
    if (this.phase.kind !== "unlock") return;
    if (this.busy) return;
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
        await this.authenticateBiometry(reason);
      }
      if (role === "invited") {
        const status = await this.deps.teamUnlock();
        await this.enterAppAfterUnlock("invited", status);
        return;
      }
      const status = await this.deps.ownerUnlock();
      await this.enterAppAfterUnlock("owner", status);
    } catch (err) {
      const shown = visibleUnlockError(err);
      runInAction(() => {
        if (this.isNoSavedSessionError(shown)) {
          this.error = null;
          this.phase = { kind: "unlock", role, mode: "secret" };
        } else {
          this.error = shown;
          this.phase = { kind: "unlock", role, mode: "idle" };
        }
        this.busy = false;
      });
    }
  }

  /** Switch the unlock view to the secret (passtoken / password) form. */
  showSecretForm(): void {
    if (this.phase.kind !== "unlock") return;
    this.phase = { kind: "unlock", role: this.phase.role, mode: "secret" };
    this.error = null;
  }

  /** Leave the secret form. Return to Touch ID when a keyring secret exists. */
  requestPrompt(): void {
    if (this.phase.kind !== "unlock") return;
    const role = this.phase.role;
    this.error = null;
    if (this.hasKeyringUnlock(role)) {
      if (this.wantsBiometryUnlock(role)) {
        void this.promptUnlock();
      } else {
        this.phase = { kind: "unlock", role, mode: "idle" };
      }
      return;
    }
    this.phase = { kind: "unlock", role, mode: "secret" };
  }

  /** Owner: exchange username + passtoken for a session. */
  async loginWithPasstoken(input: {
    workerUrl: string;
    username: string;
    passtoken: string;
  }): Promise<void> {
    const passtoken = normalizePasstokenInput(input.passtoken);
    const username = input.username.trim();
    const workerUrl = input.workerUrl.trim().replace(/\/$/, "");
    if (!isValidPasstokenFormat(passtoken)) {
      const hint = passtokenFormatHint();
      runInAction(() => {
        this.error = hint;
        this.busy = false;
      });
      throw new Error(hint);
    }
    this.busy = true;
    this.error = null;
    try {
      const status = await this.deps.ownerLogin({
        workerUrl,
        username,
        passtoken,
        biometryEnabled: false,
      });
      runInAction(() => {
        this.ownerStatus = status;
      });
      await this.deps.refreshIdentity();
      runInAction(() => {
        if (
          this.deps.isDesktop() &&
          status.platform !== "linux" &&
          status.hasRefresh
        ) {
          this.phase = { kind: "offerBiometry", role: "owner" };
          this.busy = false;
          return;
        }
        this.phase = this.hasWorkerConnected()
          ? { kind: "ownerReady" }
          : { kind: "choice" };
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
      });
      await this.deps.refreshIdentity();
      runInAction(() => {
        this.busy = false;
        // First login: offer biometry once (desktop with biometry only).
        if (this.deps.isDesktop() && status.platform !== "linux") {
          this.phase = { kind: "offerBiometry", role: "invited" };
        } else {
          this.phase = this.hasWorkerConnected()
            ? { kind: "invitedReady" }
            : { kind: "invitedLogin" };
        }
      });
    } catch (err) {
      const shown = visibleUnlockError(err) ?? "Team login failed.";
      runInAction(() => {
        this.error = shown;
        this.busy = false;
      });
      throw err;
    }
  }

  /** Accepted biometry: persist preference in the keyring and enter the app. */
  async acceptBiometry(): Promise<void> {
    if (this.phase.kind !== "offerBiometry") return;
    const { role } = this.phase;
    this.busy = true;
    try {
      if (role === "owner") {
        const status = await this.deps.ownerSetBiometryEnabled(true);
        runInAction(() => {
          this.ownerStatus = status;
        });
      } else {
        const status = await this.deps.teamSetBiometryEnabled(true);
        runInAction(() => {
          this.teamStatus = status;
        });
      }
      await this.deps.refreshIdentity();
      runInAction(() => {
        if (role === "owner") {
          this.phase = this.hasWorkerConnected()
            ? { kind: "ownerReady" }
            : { kind: "choice" };
        } else {
          this.phase = this.hasWorkerConnected()
            ? { kind: "invitedReady" }
            : { kind: "invitedLogin" };
        }
        this.busy = false;
      });
    } catch (err) {
      runInAction(() => {
        this.error = visibleUnlockError(err) ?? "Could not enable biometry.";
        this.busy = false;
      });
    }
  }

  /** Declined biometry: persist opt-out and still enter the app this run. */
  async declineBiometry(): Promise<void> {
    if (this.phase.kind !== "offerBiometry") return;
    const { role } = this.phase;
    this.busy = true;
    try {
      if (role === "owner") {
        const status = await this.deps.ownerSetBiometryEnabled(false);
        runInAction(() => {
          this.ownerStatus = status;
        });
      } else {
        const status = await this.deps.teamSetBiometryEnabled(false);
        runInAction(() => {
          this.teamStatus = status;
        });
      }
      await this.deps.refreshIdentity();
      runInAction(() => {
        if (role === "owner") {
          this.phase = this.hasWorkerConnected()
            ? { kind: "ownerReady" }
            : { kind: "choice" };
        } else {
          this.phase = this.hasWorkerConnected()
            ? { kind: "invitedReady" }
            : { kind: "invitedLogin" };
        }
        this.busy = false;
      });
    } catch {
      await this.deps.refreshIdentity();
      runInAction(() => {
        if (role === "owner") {
          this.phase = this.hasWorkerConnected()
            ? { kind: "ownerReady" }
            : { kind: "choice" };
        } else {
          this.phase = this.hasWorkerConnected()
            ? { kind: "invitedReady" }
            : { kind: "invitedLogin" };
        }
        this.busy = false;
      });
    }
  }

  /** Invited unlock: forget the team session and enter owner login / unlock. */
  async switchToOwnerLogin(): Promise<void> {
    this.busy = true;
    this.error = null;
    try {
      await this.deps.teamForgetSession();
      await this.deps.refreshIdentity();
      const [owner, team] = await Promise.all([
        this.deps.ownerSessionStatus(),
        this.deps.teamSessionStatus(),
      ]);
      runInAction(() => {
        this.ownerStatus = owner;
        this.teamStatus = team;
        this.error = null;
        this.revealedPasstoken = null;
        this.prompted = false;
        this.busy = false;
        if (owner?.hasRefresh) {
          this.enterUnlockForRole("owner");
          return;
        }
        this.phase = {
          kind: "unlock",
          role: "owner",
          mode: this.resolvedWorkerUrl("owner")
            ? this.unlockSurfaceMode("owner")
            : "secret",
        };
      });
    } catch (err) {
      const shown =
        visibleUnlockError(err) ?? "Could not switch to owner login.";
      runInAction(() => {
        this.error = shown;
        this.busy = false;
      });
      throw err;
    }
  }

  /** "I was invited" from the welcome screen — enter team login or unlock. */
  openInvitedLogin(): void {
    this.error = null;
    if (
      this.phase.kind === "invitedReady" ||
      (this.phase.kind === "offerBiometry" && this.phase.role === "invited") ||
      (this.phase.kind === "unlock" && this.phase.role === "invited")
    ) {
      return;
    }
    if (this.teamStatus?.hasSecret || this.teamStatus?.hasAccess) {
      this.enterUnlockForRole("invited");
      return;
    }
    this.phase = { kind: "invitedLogin" };
  }

  /** "Already installed" from the welcome screen — enter the unlock flow. */
  openAlreadyInstalled(): void {
    this.error = null;
    const teamUrl = this.identity.teamIdentity?.workerUrl?.trim() ?? "";
    if (this.teamStatus?.hasSecret || this.teamStatus?.hasAccess || teamUrl) {
      if (this.teamStatus?.hasSecret || this.teamStatus?.hasAccess) {
        this.enterUnlockForRole("invited");
      } else {
        this.phase = {
          kind: "unlock",
          role: "invited",
          mode: this.unlockSurfaceMode("invited"),
        };
      }
      return;
    }
    if (this.ownerStatus?.hasRefresh) {
      this.enterUnlockForRole("owner");
      return;
    }
    if (this.resolvedWorkerUrl("owner")) {
      this.phase = {
        kind: "unlock",
        role: "owner",
        mode: this.unlockSurfaceMode("owner"),
      };
      return;
    }
    this.phase = { kind: "unlock", role: "owner", mode: "secret" };
  }

  /** Lock the active session and return to unlock (Touch ID) or welcome. */
  async signOut(): Promise<void> {
    this.busy = true;
    const invited =
      this.role === "invited" ||
      Boolean(this.teamStatus?.hasAccess || this.teamStatus?.hasSecret);
    try {
      if (invited) {
        await this.deps.teamLogout();
        await this.deps.clearTeamDisk();
      } else {
        await this.deps.ownerLogout();
        await this.deps.clearOwnerDisk();
      }
    } catch {
      /* best-effort */
    }
    try {
      await this.deps.refreshIdentity();
    } catch {
      /* best-effort */
    }
    let owner = this.ownerStatus;
    let team = this.teamStatus;
    try {
      [owner, team] = await Promise.all([
        this.deps.ownerSessionStatus(),
        this.deps.teamSessionStatus(),
      ]);
    } catch {
      /* keep last known status */
    }
    runInAction(() => {
      this.ownerStatus = owner;
      this.teamStatus = team;
      this.statusesHydrated = true;
      this.error = null;
      this.revealedPasstoken = null;
      this.prompted = false;
      this.busy = false;

      if (invited) {
        if (team?.hasSecret) {
          this.enterUnlockForRole("invited");
        } else {
          this.phase = { kind: "invitedLogin" };
        }
        return;
      }
      if (owner?.hasRefresh) {
        this.enterUnlockForRole("owner");
        return;
      }
      this.phase = { kind: "choice" };
    });
  }

  /** Owner forgot passtoken: enter the recover view (CF access token reset). */
  enterRecover(): void {
    this.phase = { kind: "ownerRecover" };
    this.error = null;
  }

  /** Leave forgot-passtoken recovery and return to UnlockView. */
  leaveRecover(): void {
    this.error = null;
    this.phase = {
      kind: "unlock",
      role: "owner",
      mode: this.unlockSurfaceMode("owner"),
    };
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
      if (
        this.phase.kind === "ownerReady" &&
        !owner.hasAccess &&
        !owner.hasRefresh
      ) {
        runInAction(() => {
          this.phase = { kind: "unlock", role: "owner", mode: "idle" };
        });
        return;
      }
      if (
        this.phase.kind === "invitedReady" &&
        !team.hasAccess &&
        !team.hasSecret
      ) {
        runInAction(() => {
          this.phase = { kind: "unlock", role: "invited", mode: "idle" };
        });
        return;
      }
      this.reconcileFromStatuses();
      if (this.phase.kind === "unlock" && this.phase.mode === "prompting") {
        void this.promptUnlock();
      }
    } catch {
      /* keep current phase */
    }
  }
}
