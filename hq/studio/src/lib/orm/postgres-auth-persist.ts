import type { HqAuthStore } from "@db/auth-types";
import { getStudioDataSource } from "@lib/orm/data-source";
import {
  HqAuthUserEntity,
  HqPasswordResetTokenEntity,
  HqRefreshTokenEntity,
} from "@db/entities/auth.entities";

function isoRequired(value: Date): string {
  return value.toISOString();
}

export async function loadAuthStoreFromPostgres(): Promise<HqAuthStore> {
  const dataSource = getStudioDataSource();
  const [users, refreshTokens, passwordResetTokens] = await Promise.all([
    dataSource.getRepository(HqAuthUserEntity).find(),
    dataSource.getRepository(HqRefreshTokenEntity).find(),
    dataSource.getRepository(HqPasswordResetTokenEntity).find(),
  ]);

  return {
    version: 1,
    users: users.map((row) => ({
      id: row.id,
      accountLinkId: row.accountLinkId,
      email: row.email,
      passwordHash: row.passwordHash,
      name: row.name,
      type: row.type === "team" ? "team" : "owner",
      username: row.username,
      cfAccountId: row.cfAccountId,
      workerUrl: row.workerUrl,
      passtokenEnc: row.passtokenEnc,
      createdAt: isoRequired(row.createdAt),
      updatedAt: isoRequired(row.updatedAt),
    })),
    refreshTokens: refreshTokens.map((row) => ({
      id: row.id,
      tokenHash: row.tokenHash,
      userId: row.userId,
      expiresAt: isoRequired(row.expiresAt),
      createdAt: isoRequired(row.createdAt),
      userAgent: row.userAgent,
      ip: row.ip,
    })),
    passwordResetTokens: passwordResetTokens.map((row) => ({
      id: row.id,
      tokenHash: row.tokenHash,
      userId: row.userId,
      expiresAt: isoRequired(row.expiresAt),
      createdAt: isoRequired(row.createdAt),
      used: row.used,
    })),
  };
}
