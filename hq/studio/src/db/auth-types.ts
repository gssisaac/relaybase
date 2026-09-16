export type HqAuthUser = {
  id: string;
  email: string;
  passwordHash: string;
  name: string | null;
  accountLinkId: string;
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
