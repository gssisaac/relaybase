"use client";

import { makeAutoObservable, runInAction } from "mobx";

import { isSystemCanceledBiometry } from "../biometry/dismiss";
import type { OwnerSessionStatus, TeamSessionStatus } from "../bridge";
import { createDefaultDeps } from "./defaults";
import { isStayOnMailConsoleUnlockError, visibleUnlockError } from "./errors";
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
 * Mail unlock is silent on boot (keyring refresh → owner_boot_mail /
 * team_unlock). The passtoken / mobile-password form is first-login and
 * fallback only. Console dashboard access is gated separately via Touch ID
 * (`ensureConsoleAccess` / `ConsoleGateView`).
 */

export class AppSessionStore {
  phase: AppSessionPhase = { kind: "boot" };
  ownerStatus: OwnerSessionStatus | null = null;
  teamStatus: TeamSessionStatus | null = null;
  error: string | null = null;
  revealedPasstoken: { username: string; passtoken: string } | null = null;
  busy = false;
  consoleGateOpen = false;

  private identity: IdentitySnapshot = {
    ready: false,
    isDesktop: false,
    credentials: null,
    teamIdentity: null,
  };
  private statusesHydrated = false;
  /** True while the first silent keyring unlock attempt is in flight. */
  private silentBootPending = false;
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
      case "ownerReady":
      case "ownerRecover":
        return "owner";
      case "unlock":
        return this.phase.role;
      default:
        return "none";
    }
  }

  get hasConsoleAccess(): boolean {
    return Boolean(this.ownerStatus?.hasConsoleAccess);
  }

  get canShowApp(): boolean {
    if (this.phase.kind === "ownerReady") {
      return this.hasOwnerMailAccess() && this.hasWorkerConnected();
    }
    if (this.phase.kind === "invitedReady") {
      return Boolean(this.teamStatus?.hasAccess) && this.hasWorkerConnected();
    }
    return false;
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

  private hasOwnerMailAccess(): boolean {
    const owner = this.ownerStatus;
    if (!owner) return false;
    return owner.hasMailAccess || owner.hasAccess;
  }

  private hasOwnerMailRefresh(): boolean {
    const owner = this.ownerStatus;
    if (!owner) return false;
    return owner.hasMailRefresh || owner.hasRefresh;
  }

  private hasOwnerConsoleRefresh(): boolean {
    const owner = this.ownerStatus;
    if (!owner) return false;
    return owner.hasConsoleRefresh || owner.hasRefresh;
  }

  // --- Hydration ---

  /** Push the latest owner/team keyring status and run silent boot unlock. */
  setStatuses(owner: OwnerSessionStatus, team: TeamSessionStatus): void {
    this.ownerStatus = owner;
    this.teamStatus = team;
    this.statusesHydrated = true;
    if (this.needsSilentBoot()) {
      this.silentBootPending = true;
      if (
        this.phase.kind !== "install" &&
        this.phase.kind !== "ownerRecover" &&
        this.phase.kind !== "invitedLogin"
      ) {
        this.phase = { kind: "boot" };
      }
      void this.bootFromKeyring();
      return;
    }
    this.silentBootPending = false;
    this.reconcileFromStatuses();
  }

  /** Push the latest identity snapshot from DesktopContext. */
  setIdentity(snapshot: IdentitySnapshot): void {
    this.identity = snapshot;
    if (snapshot.ready) {
      this.reconcileFromStatuses();
    }
  }

  private needsSilentBoot(): boolean {
    const team = this.teamStatus;
    if (this.identity.teamIdentity || (team && team.hasSecret)) {
      return Boolean(team?.hasSecret && !team.hasAccess);
    }
    const owner = this.ownerStatus;
    return Boolean(
      owner && this.hasOwnerMailRefresh() && !this.hasOwnerMailAccess(),
    );
  }

  /** Silent keyring boot: mail for owner, password for invited. */
  private async bootFromKeyring(): Promise<void> {
    const team = this.teamStatus;
    const owner = this.ownerStatus;

    try {
      if (this.identity.teamIdentity || (team && team.hasSecret)) {
        if (team?.hasSecret && !team.hasAccess) {
          const status = await this.deps.teamUnlock();
          runInAction(() => {
            this.teamStatus = status;
          });
          await this.deps.refreshIdentity();
        }
      } else if (
        owner &&
        this.hasOwnerMailRefresh() &&
        !this.hasOwnerMailAccess()
      ) {
        const status = await this.deps.ownerBootMail();
        runInAction(() => {
          this.ownerStatus = status;
        });
        await this.deps.refreshIdentity();
      }
    } catch {
      /* reconcile falls back to the secret form */
    }

    runInAction(() => {
      this.silentBootPending = false;
      this.reconcileFromStatuses();
    });
  }

  private reconcileFromStatuses(): void {
    const team = this.teamStatus;

    if (
      this.phase.kind === "install" ||
      this.phase.kind === "ownerRecover"
    ) {
      return;
    }

    if (this.phase.kind === "invitedLogin") {
      if (team?.hasAccess) {
        this.phase = this.hasWorkerConnected()
          ? { kind: "invitedReady" }
          : this.phase;
        return;
      }
      if (team?.hasSecret && !team.hasAccess) {
        this.phase = { kind: "unlock", role: "invited", mode: "secret" };
      }
      return;
    }

    // Hold BootScreen until keyring status + silent unlock attempt finish.
    if (!this.statusesHydrated || this.silentBootPending) {
      if (this.phase.kind !== "boot") this.phase = { kind: "boot" };
      return;
    }

    if (this.phase.kind === "ownerReady") {
      if (this.hasOwnerMailAccess() && this.hasWorkerConnected()) return;
      if (this.hasOwnerMailAccess() && this.identity.ready) {
        this.phase = { kind: "choice" };
        return;
      }
      if (this.hasOwnerMailRefresh()) {
        this.phase = { kind: "unlock", role: "owner", mode: "secret" };
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
        this.phase = { kind: "unlock", role: "invited", mode: "secret" };
      }
      return;
    }

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
        this.phase = { kind: "unlock", role: "invited", mode: "secret" };
        return;
      }
      if (this.identity.ready) {
        this.phase = { kind: "invitedLogin" };
      }
      return;
    }

    if (this.hasOwnerMailAccess()) {
      if (this.hasWorkerConnected()) {
        this.phase = { kind: "ownerReady" };
      } else if (this.identity.ready) {
        this.phase = { kind: "choice" };
      }
      return;
    }

    if (this.hasOwnerMailRefresh()) {
      this.phase = { kind: "unlock", role: "owner", mode: "secret" };
      return;
    }

    if (!this.identity.ready) {
      if (this.phase.kind !== "boot") this.phase = { kind: "boot" };
      return;
    }

    if (this.resolvedWorkerUrl("owner")) {
      this.phase = { kind: "unlock", role: "owner", mode: "secret" };
      return;
    }

    if (this.phase.kind === "unlock") {
      return;
    }

    this.phase = { kind: "choice" };
  }

  // --- Console gate ---

  private async authenticateBiometry(reason: string): Promise<void> {
    try {
      await this.deps.authenticateBiometry(reason);
    } catch (err) {
      if (!isSystemCanceledBiometry(err)) throw err;
      await new Promise((r) => setTimeout(r, 200));
      await this.deps.authenticateBiometry(reason);
    }
  }

  /** Touch ID / Windows Hello for console only. Returns true when unlocked. */
  async ensureConsoleAccess(): Promise<boolean> {
    if (this.hasConsoleAccess) return true;

    if (this.hasOwnerConsoleRefresh()) {
      this.busy = true;
      this.error = null;
      try {
        if (this.deps.isDesktop()) {
          await this.authenticateBiometry("Unlock Relaybase console");
        }
        const status = await this.deps.ownerUnlockConsole();
        runInAction(() => {
          this.ownerStatus = status;
          this.consoleGateOpen = false;
          this.busy = false;
        });
        try {
          await this.deps.refreshIdentity();
        } catch {
          // Unlock already succeeded; identity refresh is best-effort.
        }
        return this.hasConsoleAccess;
      } catch (err) {
        runInAction(() => {
          this.busy = false;
        });
        if (isStayOnMailConsoleUnlockError(err)) {
          return false;
        }
      }
    }

    runInAction(() => {
      this.consoleGateOpen = true;
    });
    return false;
  }

  /** Passtoken login for the console gate overlay. */
  async loginConsoleWithPasstoken(input: {
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
      const loginStatus = await this.deps.ownerLogin({
        workerUrl,
        username,
        passtoken,
      });
      runInAction(() => {
        this.ownerStatus = loginStatus;
      });
      await this.deps.refreshIdentity();
      const consoleStatus = await this.deps.ownerUnlockConsole();
      if (!consoleStatus.hasConsoleAccess) {
        throw new Error("Console unlock failed.");
      }
      runInAction(() => {
        this.ownerStatus = consoleStatus;
        this.consoleGateOpen = false;
        this.error = null;
        this.busy = false;
        if (this.hasOwnerMailAccess() && this.hasWorkerConnected()) {
          this.phase = { kind: "ownerReady" };
        }
      });
    } catch (err) {
      const shown = visibleUnlockError(err, "owner") ?? "Console sign-in failed.";
      runInAction(() => {
        this.error = shown;
        this.busy = false;
      });
      throw err;
    }
  }

  // --- Actions ---

  showSecretForm(): void {
    if (this.phase.kind !== "unlock") return;
    this.phase = { kind: "unlock", role: this.phase.role, mode: "secret" };
    this.error = null;
  }

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
      });
      runInAction(() => {
        this.ownerStatus = status;
      });
      await this.deps.refreshIdentity();
      runInAction(() => {
        this.phase =
          this.hasOwnerMailAccess() && this.hasWorkerConnected()
            ? { kind: "ownerReady" }
            : { kind: "choice" };
        this.busy = false;
      });
    } catch (err) {
      const shown = visibleUnlockError(err, "owner") ?? "Sign in failed.";
      runInAction(() => {
        this.error = shown;
        this.busy = false;
      });
      throw err;
    }
  }

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
        this.phase = this.hasWorkerConnected()
          ? { kind: "invitedReady" }
          : { kind: "invitedLogin" };
        this.busy = false;
      });
    } catch (err) {
      const shown = visibleUnlockError(err, "invited") ?? "Team login failed.";
      runInAction(() => {
        this.error = shown;
        this.busy = false;
      });
      throw err;
    }
  }

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
        this.busy = false;
        this.phase = { kind: "unlock", role: "owner", mode: "secret" };
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

  openInvitedLogin(): void {
    this.error = null;
    if (
      this.phase.kind === "invitedReady" ||
      (this.phase.kind === "unlock" && this.phase.role === "invited")
    ) {
      return;
    }
    if (this.teamStatus?.hasSecret || this.teamStatus?.hasAccess) {
      this.phase = { kind: "unlock", role: "invited", mode: "secret" };
      return;
    }
    this.phase = { kind: "invitedLogin" };
  }

  openAlreadyInstalled(): void {
    this.error = null;
    const teamUrl = this.identity.teamIdentity?.workerUrl?.trim() ?? "";
    if (this.teamStatus?.hasSecret || this.teamStatus?.hasAccess || teamUrl) {
      this.phase = { kind: "unlock", role: "invited", mode: "secret" };
      return;
    }
    this.phase = { kind: "unlock", role: "owner", mode: "secret" };
  }

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
      this.consoleGateOpen = false;
      this.busy = false;

      if (invited) {
        if (team?.hasSecret) {
          this.phase = { kind: "unlock", role: "invited", mode: "secret" };
        } else {
          this.phase = { kind: "invitedLogin" };
        }
        return;
      }
      if (this.hasOwnerMailRefresh()) {
        this.phase = { kind: "unlock", role: "owner", mode: "secret" };
        return;
      }
      this.phase = { kind: "choice" };
    });
  }

  enterRecover(): void {
    this.phase = { kind: "ownerRecover" };
    this.error = null;
  }

  leaveRecover(): void {
    this.error = null;
    this.phase = { kind: "unlock", role: "owner", mode: "secret" };
  }

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

  consumeRevealedPasstoken(): void {
    this.revealedPasstoken = null;
    runInAction(() => {
      this.phase = { kind: "unlock", role: "owner", mode: "secret" };
    });
  }

  clearError(): void {
    this.error = null;
  }

  closeConsoleGate(): void {
    this.consoleGateOpen = false;
    this.error = null;
  }

  /**
   * Mail Worker returned 401. Re-fetch keyring status and retry silent
   * mail boot — do not wipe the worker URL or keyring.
   */
  async handleWorkerUnauthorized(): Promise<void> {
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
        !this.hasOwnerMailAccess() &&
        this.hasOwnerMailRefresh()
      ) {
        try {
          const status = await this.deps.ownerBootMail();
          runInAction(() => {
            this.ownerStatus = status;
          });
          await this.deps.refreshIdentity();
          if (this.hasOwnerMailAccess()) {
            runInAction(() => {
              this.reconcileFromStatuses();
            });
            return;
          }
        } catch {
          /* fall through to secret form */
        }
      }

      if (
        this.phase.kind === "ownerReady" &&
        !this.hasOwnerMailAccess() &&
        !this.hasOwnerMailRefresh()
      ) {
        runInAction(() => {
          this.phase = { kind: "unlock", role: "owner", mode: "secret" };
        });
        return;
      }

      if (
        this.phase.kind === "invitedReady" &&
        !team.hasAccess &&
        !team.hasSecret
      ) {
        runInAction(() => {
          this.phase = { kind: "unlock", role: "invited", mode: "secret" };
        });
        return;
      }

      runInAction(() => {
        this.reconcileFromStatuses();
      });
    } catch {
      /* keep current phase */
    }
  }

  /** Console Worker returned 401 — open the console gate overlay. */
  async handleConsoleUnauthorized(): Promise<void> {
    runInAction(() => {
      this.consoleGateOpen = true;
    });
    try {
      const owner = await this.deps.ownerSessionStatus();
      runInAction(() => {
        this.ownerStatus = owner;
      });
    } catch {
      runInAction(() => {
        if (this.ownerStatus) {
          this.ownerStatus = {
            ...this.ownerStatus,
            hasConsoleAccess: false,
          };
        }
      });
    }
  }
}
