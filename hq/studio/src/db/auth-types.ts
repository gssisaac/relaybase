export type HqUserType = "owner" | "team";

export type HqAuthUser = {
  id: string;
  /** Legacy email login; cloud accounts may use username only. */
  email: string;
  passwordHash: string;
  name: string | null;
  accountLinkId: string;
  /** Cloud account role — console access requires owner. */
  type: HqUserType;
  /** Cloud login id (unique). */
  username?: string | null;
  cfAccountId?: string | null;
  workerUrl?: string | null;
  passtokenEnc?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type HqRefreshTokenRecord = {
  id: string;
  tokenHash: string;
  userId: string;
  expiresAt: string;
  createdAt: string;
  userAgent: string | null;
  ip: string | null;
};

export type HqPasswordResetTokenRecord = {
  id: string;
  tokenHash: string;
  userId: string;
  expiresAt: string;
  createdAt: string;
  used: boolean;
};

export type HqAuthStore = {
  version: 1;
  users: HqAuthUser[];
  refreshTokens: HqRefreshTokenRecord[];
  passwordResetTokens: HqPasswordResetTokenRecord[];
};
