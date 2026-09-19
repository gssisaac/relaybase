import { loadAuthStoreFromPostgres } from "@lib/orm/postgres-auth-persist";
import {
  enqueueAuthPersist,
  patchPostgresAuthCache,
  readPostgresAuthClone,
  setPostgresAuthCache,
} from "@lib/db/postgres-auth-runtime";
import type {
  HqAuthStore,
  HqAuthUser,
  HqPasswordResetTokenRecord,
  HqRefreshTokenRecord,
} from "@db/auth-types";
import {
  deleteRefreshTokenById,
  deleteRefreshTokensForUser,
  markPasswordResetTokenUsed,
  saveAuthUser,
  savePasswordResetToken,
  saveRefreshToken,
} from "@services/auth/auth.repository";

function normalizeAuthStore(raw: HqAuthStore): HqAuthStore {
  return {
    version: 1,
    users: raw.users ?? [],
    refreshTokens: raw.refreshTokens ?? [],
    passwordResetTokens: raw.passwordResetTokens ?? [],
  };
}

function readAuthImpl(): HqAuthStore {
  return readPostgresAuthClone();
}

export async function initPostgresAuthService(): Promise<void> {
  const loaded = await loadAuthStoreFromPostgres();
  setPostgresAuthCache(normalizeAuthStore(loaded));
}

export const authService = {
  read(): HqAuthStore {
    return readAuthImpl();
  },

  findUserByEmail(email: string): HqAuthUser | null {
    const normalized = email.trim().toLowerCase();
    return readAuthImpl().users.find((u) => u.email === normalized) ?? null;
  },

  findUserByUsername(username: string): HqAuthUser | null {
    const normalized = username.trim().toLowerCase();
    return readAuthImpl().users.find((u) => u.username === normalized) ?? null;
  },

  findUserByCfAccountId(cfAccountId: string): HqAuthUser | null {
    const normalized = cfAccountId.trim().toLowerCase();
    return readAuthImpl().users.find((u) => u.cfAccountId === normalized) ?? null;
  },

  findUserById(userId: string): HqAuthUser | null {
    return readAuthImpl().users.find((u) => u.id === userId) ?? null;
  },

  createUser(user: HqAuthUser): HqAuthUser {
    patchPostgresAuthCache((draft) => {
      draft.users.push(user);
    });
    enqueueAuthPersist(() => saveAuthUser(user));
    return user;
  },

  updateUser(userId: string, patch: Partial<Pick<HqAuthUser, "passwordHash" | "updatedAt" | "name">>): HqAuthUser | null {
    let updated: HqAuthUser | null = null;
    patchPostgresAuthCache((draft) => {
      const row = draft.users.find((u) => u.id === userId);
      if (!row) return;
      if (patch.passwordHash !== undefined) row.passwordHash = patch.passwordHash;
      if (patch.updatedAt !== undefined) row.updatedAt = patch.updatedAt;
      if (patch.name !== undefined) row.name = patch.name;
      updated = { ...row };
    });
    if (updated) {
      enqueueAuthPersist(() => saveAuthUser(updated!));
    }
    return updated;
  },

  addRefreshToken(record: HqRefreshTokenRecord): void {
    patchPostgresAuthCache((draft) => {
      draft.refreshTokens.push(record);
    });
    enqueueAuthPersist(() => saveRefreshToken(record));
  },

  replaceRefreshToken(oldId: string, next: HqRefreshTokenRecord): void {
    patchPostgresAuthCache((draft) => {
      draft.refreshTokens = draft.refreshTokens.filter((t) => t.id !== oldId);
      draft.refreshTokens.push(next);
    });
    enqueueAuthPersist(async () => {
      await deleteRefreshTokenById(oldId);
      await saveRefreshToken(next);
    });
  },

  revokeRefreshTokenById(id: string): void {
    patchPostgresAuthCache((draft) => {
      draft.refreshTokens = draft.refreshTokens.filter((t) => t.id !== id);
    });
    enqueueAuthPersist(() => deleteRefreshTokenById(id));
  },

  revokeAllRefreshTokensForUser(userId: string): void {
    patchPostgresAuthCache((draft) => {
      draft.refreshTokens = draft.refreshTokens.filter((t) => t.userId !== userId);
    });
    enqueueAuthPersist(() => deleteRefreshTokensForUser(userId));
  },

  findRefreshTokenByHash(tokenHash: string): HqRefreshTokenRecord | null {
    return readAuthImpl().refreshTokens.find((t) => t.tokenHash === tokenHash) ?? null;
  },

  addPasswordResetToken(record: HqPasswordResetTokenRecord): void {
    patchPostgresAuthCache((draft) => {
      draft.passwordResetTokens.push(record);
    });
    enqueueAuthPersist(() => savePasswordResetToken(record));
  },

  findPasswordResetByHash(tokenHash: string): HqPasswordResetTokenRecord | null {
    return readAuthImpl().passwordResetTokens.find((t) => t.tokenHash === tokenHash) ?? null;
  },

  markPasswordResetUsed(id: string): void {
    patchPostgresAuthCache((draft) => {
      const row = draft.passwordResetTokens.find((t) => t.id === id);
      if (row) row.used = true;
    });
    enqueueAuthPersist(() => markPasswordResetTokenUsed(id));
  },
};
