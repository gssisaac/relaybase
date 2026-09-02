"use client";

import { makeAutoObservable, runInAction } from "mobx";

import { isUserDismissedBiometry } from "../biometry/dismiss";
import type { OwnerSessionStatus, TeamSessionStatus } from "../bridge";
import { createDefaultDeps } from "./defaults";
import { isWorkerUnreachableError, visibleUnlockError } from "./errors";
import { resolveWorkerUrl } from "./resolve-worker-url";
import {
  clearDesktopSessionCache,
  clearScopeDependentLocalStorage,
} from "../shell/session-cache";
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
 * team_unlock). When a new login is needed, Touch ID reads the keyring
 * passtoken. The typed form is first-login and bio-fail / decline only.
 */

export class AppSessionStore {
  phase: AppSessionPhase = { kind: "boot" };
  ownerStatus: OwnerSessionStatus | null = null;
  teamStatus: TeamSessionStatus | null = null;
  error: string | null = null;
  revealedPasstoken: { passtoken: string } | null = null;
  busy = false;
  consoleGateOpen = false;
  /** Last Worker call failed because the network / Worker was unreachable. */
  workerUnreachable = false;
  /** Worker D1 passtoken prefix from GET /console/auth-status (non-secret). */
  workerPasstokenPrefix: string | null = null;
  /** Set when the user dismissed Touch ID on the unlock form. */
  bioDismissed = false;
  private consoleUnauthorizedInFlight = false;

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
      { deps: false, consoleUnauthorizedInFlight: false } as unknown as never,
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
      return this.hasOwnerWorkerUrl() && this.ownerCanEnterMailbox();
    }
    if (this.phase.kind === "invitedReady") {
      return this.hasInvitedWorkerUrl() && this.invitedCanEnterMailbox();
    }
    return false;
  }

  get canTryOwnerBio(): boolean {
    if (!this.ownerStatus?.hasPasstoken) return false;
    return !this.ownerBioPrefixMismatch;
  }

  get ownerBioPrefixMismatch(): boolean {
    const keyringPrefix = this.ownerStatus?.keyringPasstokenPrefix?.trim();
    const workerPrefix = this.workerPasstokenPrefix?.trim();
    return Boolean(
      this.ownerStatus?.hasPasstoken &&
        keyringPrefix &&
        workerPrefix &&
        keyringPrefix !== workerPrefix,
    );
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

  private hasOwnerPasstoken(): boolean {
    return Boolean(this.ownerStatus?.hasPasstoken);
  }

  private hasOwnerWorkerUrl(): boolean {
    return Boolean(this.resolvedWorkerUrl("owner"));
  }

  private hasInvitedWorkerUrl(): boolean {
    return Boolean(this.resolvedWorkerUrl("invited"));
  }

  private enrolledAsInvited(): boolean {
    return Boolean(
      this.hasInvitedWorkerUrl() &&
        (this.identity.teamIdentity || this.teamStatus?.hasSecret),
    );
  }

  private enrolledAsOwner(): boolean {
    return Boolean(
      this.hasOwnerWorkerUrl() &&
        (this.hasOwnerMailRefresh() || this.hasOwnerPasstoken()),
    );
  }

  private ownerCanEnterMailbox(): boolean {
    return (
      this.hasOwnerMailAccess() ||
      (this.workerUnreachable && this.enrolledAsOwner())
    );
  }

  private invitedCanEnterMailbox(): boolean {
    return (
      Boolean(this.teamStatus?.hasAccess) ||
      (this.workerUnreachable && this.enrolledAsInvited())
    );
  }

  private markWorkerReachable(): void {
    this.workerUnreachable = false;
  }

  private markWorkerUnreachable(): void {
    this.workerUnreachable = true;
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
    if (!this.hasWorkerConnected()) {
      return false;
    }
    const team = this.teamStatus;
    if (this.identity.teamIdentity || (team && team.hasSecret)) {
      return Boolean(team?.hasSecret && !team.hasAccess);
    }
    const owner = this.ownerStatus;
    return Boolean(
      owner &&
        !this.hasOwnerMailAccess() &&
        (this.hasOwnerMailRefresh() || this.hasOwnerPasstoken()),
    );
  }

  /** Silent keyring boot: mail for owner, password for invited. */
  private async bootFromKeyring(): Promise<void> {
    const team = this.teamStatus;
    const owner = this.ownerStatus;

    try {
      if (this.enrolledAsInvited()) {
        if (team?.hasSecret && !team.hasAccess) {
          const status = await this.deps.teamUnlock();
          runInAction(() => {
            this.teamStatus = status;
            this.markWorkerReachable();
          });
          await this.deps.refreshIdentity();
        }
      } else if (owner && !this.hasOwnerMailAccess()) {
        if (this.hasOwnerMailRefresh()) {
          const status = await this.deps.ownerBootMail();
          runInAction(() => {
            this.ownerStatus = status;
            this.markWorkerReachable();
          });
          await this.deps.refreshIdentity();
        } else if (this.hasOwnerPasstoken()) {
          const workerUrl =
            owner.workerUrl.trim() ||
            this.identity.credentials?.workerUrl?.trim() ||
            "";
          if (workerUrl) {
            await this.refreshWorkerPasstokenPrefix(workerUrl);
          }
          if (this.canTryOwnerBio) {
            await this.loginFromKeyringPasstoken(
              "Unlock Relaybase",
              workerUrl || undefined,
            );
          }
        }
      }
    } catch (err) {
      runInAction(() => {
        if (
          isWorkerUnreachableError(err) &&
          (this.enrolledAsInvited() || this.enrolledAsOwner())
        ) {
          this.markWorkerUnreachable();
        }
        if (isUserDismissedBiometry(err)) {
          this.bioDismissed = true;
        } else {
          const shown = visibleUnlockError(err, "owner");
          if (shown) this.error = shown;
        }
      });
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

    // If ~/.relaybase has no workspace connected (no workspace.json / team-login.json with workerUrl),
    // we never enter unlock or ready phases — we go directly to choice when identity is ready.
    if (!this.hasWorkerConnected()) {
      if (!this.identity.ready) {
        if (this.phase.kind !== "boot") this.phase = { kind: "boot" };
      } else {
        this.phase = { kind: "choice" };
      }
      return;
    }

    if (this.phase.kind === "invitedLogin") {
      if (this.invitedCanEnterMailbox() && this.hasInvitedWorkerUrl()) {
        this.phase = { kind: "invitedReady" };
        return;
      }
      if (team?.hasSecret && !team.hasAccess && !this.workerUnreachable) {
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
      if (this.ownerCanEnterMailbox() && this.hasOwnerWorkerUrl()) return;
      if (this.ownerCanEnterMailbox() && this.identity.ready) {
        this.phase = { kind: "choice" };
        return;
      }
      if (this.enrolledAsOwner() && !this.workerUnreachable) {
        this.phase = { kind: "unlock", role: "owner", mode: "secret" };
      }
      return;
    }

    if (this.phase.kind === "invitedReady") {
      if (this.invitedCanEnterMailbox() && this.hasInvitedWorkerUrl()) return;
      if (this.invitedCanEnterMailbox() && this.identity.ready) {
        this.phase = { kind: "invitedLogin" };
        return;
      }
      if (team?.hasSecret && !this.workerUnreachable) {
        this.phase = { kind: "unlock", role: "invited", mode: "secret" };
      }
      return;
    }

    if (this.enrolledAsInvited()) {
      if (this.invitedCanEnterMailbox() && this.hasInvitedWorkerUrl()) {
        this.phase = { kind: "invitedReady" };
        return;
      }
      if (this.invitedCanEnterMailbox() && this.identity.ready) {
        this.phase = { kind: "invitedLogin" };
        return;
      }
      if (team?.hasSecret && !this.workerUnreachable) {
        this.phase = { kind: "unlock", role: "invited", mode: "secret" };
        return;
      }
      if (this.identity.ready && !team?.hasSecret) {
        this.phase = { kind: "invitedLogin" };
      }
      return;
    }

    if (this.ownerCanEnterMailbox()) {
      if (this.hasOwnerWorkerUrl()) {
        this.phase = { kind: "ownerReady" };
      } else if (this.identity.ready) {
        this.phase = { kind: "choice" };
      }
      return;
    }

    if (this.hasOwnerMailRefresh() && !this.workerUnreachable) {
      this.phase = { kind: "unlock", role: "owner", mode: "secret" };
      return;
    }

    if (!this.identity.ready) {
      if (this.phase.kind !== "boot") this.phase = { kind: "boot" };
      return;
    }

    if (this.hasOwnerWorkerUrl()) {
      this.phase = { kind: "unlock", role: "owner", mode: "secret" };
      return;
    }

    if (this.phase.kind === "unlock") {
      return;
    }

    this.phase = { kind: "choice" };
  }

  // --- Console gate ---

  async refreshWorkerPasstokenPrefix(workerUrl?: string): Promise<void> {
    const url = (workerUrl ?? this.resolvedWorkerUrl("owner")).trim();
    if (!url) {
      runInAction(() => {
        this.workerPasstokenPrefix = null;
      });
      return;
    }
    const status = await this.deps.fetchWorkerPasstokenPrefix(url);
    runInAction(() => {
      this.workerPasstokenPrefix = status;
    });
  }

  clearBioDismissed(): void {
    this.bioDismissed = false;
  }

  /**
   * Touch ID then read `owner-passtoken` and login. Used by boot, console
   * gate, and mail 401 — JS never sees the secret.
   */
  async loginFromKeyringPasstoken(
    reason: string,
    workerUrl?: string,
  ): Promise<OwnerSessionStatus> {
    const status = await this.deps.ownerLoginFromKeyring(reason, workerUrl);
    runInAction(() => {
      this.ownerStatus = status;
      this.bioDismissed = false;
      this.markWorkerReachable();
    });
    try {
      await this.deps.refreshIdentity();
    } catch {
      /* login already succeeded */
    }
    return status;
  }

  private async unlockConsoleSilent(): Promise<boolean> {
    const status = await this.deps.ownerUnlockConsole();
    runInAction(() => {
      this.ownerStatus = status;
      this.consoleGateOpen = false;
      this.busy = false;
      this.markWorkerReachable();
    });
    try {
      await this.deps.refreshIdentity();
    } catch {
      /* unlock already succeeded */
    }
    return this.hasConsoleAccess;
  }

  /** Grant console access: silent refresh, else Touch ID → keyring passtoken. */
  async ensureConsoleAccess(workerUrl?: string): Promise<boolean> {
    if (this.hasConsoleAccess) return true;

    const resolvedUrl =
      workerUrl?.trim().replace(/\/$/, "") ||
      this.resolvedWorkerUrl("owner") ||
      undefined;

    if (this.hasOwnerConsoleRefresh()) {
      this.busy = true;
      this.error = null;
      try {
        return await this.unlockConsoleSilent();
      } catch (err) {
        runInAction(() => {
          this.busy = false;
          if (isWorkerUnreachableError(err)) this.markWorkerUnreachable();
        });
        if (isUserDismissedBiometry(err) || isWorkerUnreachableError(err)) {
          return false;
        }
      }
    }

    if (this.canTryOwnerBio) {
      this.busy = true;
      this.error = null;
      try {
        if (resolvedUrl) {
          await this.refreshWorkerPasstokenPrefix(resolvedUrl);
        }
        if (!this.canTryOwnerBio) {
          runInAction(() => {
            this.busy = false;
          });
          runInAction(() => {
            this.consoleGateOpen = true;
          });
          return false;
        }
        await this.loginFromKeyringPasstoken("Unlock Relaybase", resolvedUrl);
        if (!this.hasConsoleAccess && this.hasOwnerConsoleRefresh()) {
          return await this.unlockConsoleSilent();
        }
        runInAction(() => {
          this.consoleGateOpen = false;
          this.busy = false;
        });
        return this.hasConsoleAccess;
      } catch (err) {
        runInAction(() => {
          this.busy = false;
          if (isUserDismissedBiometry(err)) {
            this.bioDismissed = true;
          } else if (isWorkerUnreachableError(err)) {
            this.markWorkerUnreachable();
          }
          const shown = visibleUnlockError(err, "owner");
          if (shown) this.error = shown;
        });
        if (isUserDismissedBiometry(err) || isWorkerUnreachableError(err)) {
          return false;
        }
        try {
          const status = await this.deps.ownerSessionStatus();
          runInAction(() => {
            this.ownerStatus = status;
          });
        } catch {
          /* keep prior status */
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
    passtoken: string;
  }): Promise<void> {
    const passtoken = normalizePasstokenInput(input.passtoken);
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
        passtoken,
      });
      runInAction(() => {
        this.ownerStatus = loginStatus;
        this.markWorkerReachable();
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

  /** Touch ID then read keyring passtoken — UnlockView retry after boot decline. */
  async loginOwnerFromKeyring(workerUrl?: string): Promise<void> {
    if (!this.canTryOwnerBio) return;
    this.busy = true;
    this.error = null;
    this.bioDismissed = false;
    try {
      await this.loginFromKeyringPasstoken("Unlock Relaybase", workerUrl);
      runInAction(() => {
        if (this.hasOwnerMailAccess() && this.hasWorkerConnected()) {
          this.phase = { kind: "ownerReady" };
        }
        this.busy = false;
      });
    } catch (err) {
      runInAction(() => {
        this.busy = false;
        if (isUserDismissedBiometry(err)) {
          this.bioDismissed = true;
        } else if (isWorkerUnreachableError(err)) {
          this.markWorkerUnreachable();
        }
        const shown = visibleUnlockError(err, "owner");
        if (shown) this.error = shown;
      });
      try {
        const status = await this.deps.ownerSessionStatus();
        runInAction(() => {
          this.ownerStatus = status;
        });
      } catch {
        /* keep prior status */
      }
      throw err;
    }
  }

  async loginWithPasstoken(input: {
    workerUrl: string;
    passtoken: string;
  }): Promise<void> {
    const passtoken = normalizePasstokenInput(input.passtoken);
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
        passtoken,
      });
      runInAction(() => {
        this.ownerStatus = status;
        this.markWorkerReachable();
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
        this.markWorkerReachable();
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
      this.workerUnreachable = false;
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

  /**
   * Full factory reset: delete `~/.relaybase` + WebKit data, clear all
   * in-memory state, and return to the initial install screen (`choice`).
   *
   * The OS keyring (owner-session, owner-passtoken, team-session) is NOT
   * cleared by this — that is a separate explicit action. If the keyring
   * still has a mail refresh token, the next boot will silently re-login.
   * To fully return to the install screen, the caller must also clear the
   * keyring (phase A).
   */
  async factoryReset(): Promise<void> {
    this.busy = true;
    this.error = null;
    try {
      await this.deps.factoryReset();
    } catch (err) {
      runInAction(() => {
        this.error = visibleUnlockError(err) ?? "Factory reset failed.";
        this.busy = false;
      });
      throw err;
    }
    // Clear all JS in-memory state. The Rust side already deleted WebKit data
    // (localStorage, sessionStorage, IndexedDB) and ~/.relaybase.
    clearDesktopSessionCache();
    clearScopeDependentLocalStorage();
    this.deps.clearDashboardClientCache();
    runInAction(() => {
      this.ownerStatus = null;
      this.teamStatus = null;
      this.statusesHydrated = false;
      this.error = null;
      this.revealedPasstoken = null;
      this.consoleGateOpen = false;
      this.workerUnreachable = false;
      this.bioDismissed = false;
      this.busy = false;
      this.phase = { kind: "choice" };
    });
    // Reload to clear all remaining JS state (MobX stores, React tree).
    if (typeof window !== "undefined") {
      window.location.reload();
    }
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
  }): Promise<void> {
    this.busy = true;
    this.error = null;
    try {
      const result = await this.deps.ownerResetAdmin({
        workerUrl: input.workerUrl,
        cfAccessToken: input.cfAccessToken,
      });
      runInAction(() => {
        this.revealedPasstoken = {
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
    pepper: string;
  }): Promise<void> {
    this.busy = true;
    this.error = null;
    try {
      const result = await this.deps.ownerSetupAdmin({
        workerUrl: input.workerUrl,
        pepper: input.pepper,
      });
      runInAction(() => {
        this.revealedPasstoken = {
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

  async consumeRevealedPasstoken(): Promise<void> {
    const revealed = this.revealedPasstoken;
    const workerUrl =
      this.resolvedWorkerUrl("owner") ||
      this.identity.credentials?.workerUrl?.trim() ||
      "";
    this.revealedPasstoken = null;
    if (revealed && workerUrl) {
      await this.loginWithPasstoken({
        workerUrl,
        passtoken: revealed.passtoken,
      });
      return;
    }
    if (this.hasOwnerPasstoken()) {
      try {
        await this.loginFromKeyringPasstoken("Unlock Relaybase");
        runInAction(() => {
          if (this.hasOwnerMailAccess() && this.hasWorkerConnected()) {
            this.phase = { kind: "ownerReady" };
          }
        });
        return;
      } catch {
        /* fall through to typed form */
      }
    }
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
        } catch (err) {
          if (isWorkerUnreachableError(err)) {
            runInAction(() => {
              this.markWorkerUnreachable();
            });
            return;
          }
        }
      }

      if (
        this.phase.kind === "ownerReady" &&
        !this.hasOwnerMailAccess() &&
        this.hasOwnerPasstoken()
      ) {
        try {
          await this.loginFromKeyringPasstoken("Unlock Relaybase");
          if (this.hasOwnerMailAccess()) {
            runInAction(() => {
              this.reconcileFromStatuses();
            });
            return;
          }
        } catch (err) {
          if (isWorkerUnreachableError(err)) {
            runInAction(() => {
              this.markWorkerUnreachable();
            });
            return;
          }
        }
      }

      if (
        this.phase.kind === "ownerReady" &&
        !this.hasOwnerMailAccess() &&
        !this.hasOwnerMailRefresh() &&
        !this.workerUnreachable
      ) {
        runInAction(() => {
          this.phase = { kind: "unlock", role: "owner", mode: "secret" };
        });
        return;
      }

      if (
        this.phase.kind === "invitedReady" &&
        !team.hasAccess &&
        !team.hasSecret &&
        !this.workerUnreachable
      ) {
        runInAction(() => {
          this.phase = { kind: "unlock", role: "invited", mode: "secret" };
        });
        return;
      }

      runInAction(() => {
        this.reconcileFromStatuses();
      });
    } catch (err) {
      if (isWorkerUnreachableError(err)) {
        runInAction(() => {
          this.markWorkerUnreachable();
        });
      }
    }
  }

  /** Browser came back online — retry silent boot and drop the Offline badge. */
  async handleNetworkOnline(): Promise<void> {
    if (!this.workerUnreachable) return;
    runInAction(() => {
      this.workerUnreachable = false;
    });
    if (this.needsSilentBoot()) {
      this.silentBootPending = true;
      await this.bootFromKeyring();
      return;
    }
    runInAction(() => {
      this.reconcileFromStatuses();
    });
  }

  /** Console Worker returned 401 — silent refresh, else keyring passtoken, else typed gate. */
  async handleConsoleUnauthorized(): Promise<void> {
    if (this.consoleGateOpen || this.consoleUnauthorizedInFlight) return;
    this.consoleUnauthorizedInFlight = true;
    try {
      runInAction(() => {
        if (this.ownerStatus) {
          this.ownerStatus = {
            ...this.ownerStatus,
            hasConsoleAccess: false,
          };
        }
      });
      try {
        const owner = await this.deps.ownerSessionStatus();
        runInAction(() => {
          this.ownerStatus = owner;
        });
      } catch {
        /* keep last known status with access cleared */
      }
      await this.ensureConsoleAccess();
    } finally {
      this.consoleUnauthorizedInFlight = false;
    }
  }
}
