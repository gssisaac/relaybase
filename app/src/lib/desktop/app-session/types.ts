import type {
  DesktopCredentials,
  DesktopTeamLogin,
  OwnerSessionStatus,
  TeamSessionStatus,
} from "../bridge";

export type AppSessionPhase =
  | { kind: "boot" }
  | { kind: "choice" }
  | {
      kind: "install";
      step: "oauth" | "progress" | "createOwner" | "revealPasstoken";
    }
  | { kind: "invitedLogin" }
  | {
      kind: "unlock";
      role: "owner" | "invited";
      mode: "secret";
    }
  | { kind: "invitedReady" }
  | { kind: "ownerReady" }
  | { kind: "ownerRecover" };

export type SessionRole = "none" | "owner" | "invited";

export type IdentitySnapshot = {
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
    passtoken: string;
  }) => Promise<OwnerSessionStatus>;
  ownerBootMail: () => Promise<OwnerSessionStatus>;
  ownerUnlockConsole: () => Promise<OwnerSessionStatus>;
  ownerLoginFromKeyring: (
    reason: string,
    workerUrl?: string,
  ) => Promise<OwnerSessionStatus>;
  ownerLogout: () => Promise<void>;
  ownerSetupAdmin: (input: {
    workerUrl: string;
    pepper: string;
  }) => Promise<{ passtoken: string }>;
  ownerResetAdmin: (input: {
    workerUrl: string;
    cfAccessToken: string;
  }) => Promise<{ passtoken: string }>;
  teamSessionStatus: () => Promise<TeamSessionStatus>;
  teamLogin: (input: {
    workerUrl: string;
    accountEmail: string;
    mobilePassword: string;
  }) => Promise<TeamSessionStatus>;
  teamUnlock: () => Promise<TeamSessionStatus>;
  teamLogout: () => Promise<void>;
  teamForgetSession: () => Promise<TeamSessionStatus>;
  fetchWorkerPasstokenPrefix: (
    workerUrl: string,
  ) => Promise<string | null>;
  refreshIdentity: () => Promise<void>;
  clearOwnerDisk: () => Promise<void>;
  clearTeamDisk: () => Promise<void>;
};
