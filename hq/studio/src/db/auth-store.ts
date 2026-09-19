import { loadAuthStoreFromPostgres } from "./orm/postgres-auth-persist";
import {
  commitPostgresAuthCache,
  readPostgresAuthClone,
  setPostgresAuthCache,
} from "./postgres-auth-runtime";
import type {
  HqAuthStore,
  HqAuthUser,
  HqPasswordResetTokenRecord,
  HqRefreshTokenRecord,
} from "./auth-types";

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

function updateAuthImpl(mutator: (draft: HqAuthStore) => void): HqAuthStore {
  const draft = readPostgresAuthClone();
  mutator(draft);
  return commitPostgresAuthCache(normalizeAuthStore(draft));
}

export async function initPostgresAuthStore(): Promise<void> {
  const loaded = await loadAuthStoreFromPostgres();
  setPostgresAuthCache(normalizeAuthStore(loaded));
}

export const authStore = {
  read(): HqAuthStore {
    return readAuthImpl();
  },

  update(mutator: (draft: HqAuthStore) => void): HqAuthStore {
    return updateAuthImpl(mutator);
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

  addRefreshToken(record: HqRefreshTokenRecord): void {
    authStore.update((draft) => {
      draft.refreshTokens.push(record);
    });
  },

  replaceRefreshToken(oldId: string, next: HqRefreshTokenRecord): void {
    authStore.update((draft) => {
      draft.refreshTokens = draft.refreshTokens.filter((t) => t.id !== oldId);
      draft.refreshTokens.push(next);
    });
  },

  revokeRefreshTokenById(id: string): void {
    authStore.update((draft) => {
      draft.refreshTokens = draft.refreshTokens.filter((t) => t.id !== id);
    });
  },

  revokeAllRefreshTokensForUser(userId: string): void {
    authStore.update((draft) => {
      draft.refreshTokens = draft.refreshTokens.filter((t) => t.userId !== userId);
    });
  },

  findRefreshTokenByHash(tokenHash: string): HqRefreshTokenRecord | null {
    return readAuthImpl().refreshTokens.find((t) => t.tokenHash === tokenHash) ?? null;
  },

  addPasswordResetToken(record: HqPasswordResetTokenRecord): void {
    authStore.update((draft) => {
      draft.passwordResetTokens.push(record);
    });
  },

  findPasswordResetByHash(tokenHash: string): HqPasswordResetTokenRecord | null {
    return readAuthImpl().passwordResetTokens.find((t) => t.tokenHash === tokenHash) ?? null;
  },

  markPasswordResetUsed(id: string): void {
    authStore.update((draft) => {
      const row = draft.passwordResetTokens.find((t) => t.id === id);
      if (row) row.used = true;
    });
  },
};
