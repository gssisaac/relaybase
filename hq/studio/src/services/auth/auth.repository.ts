import type {
  HqAuthUser,
  HqPasswordResetTokenRecord,
  HqRefreshTokenRecord,
} from "@db/auth-types";
import {
  HqAuthUserEntity,
  HqPasswordResetTokenEntity,
  HqRefreshTokenEntity,
} from "@db/entities/auth.entities";
import { parseDateRequired } from "@lib/db/parse-date";
import { authRepos } from "@services/repositories";

function toUserEntity(row: HqAuthUser): HqAuthUserEntity {
  const entity = new HqAuthUserEntity();
  entity.id = row.id;
  entity.accountLinkId = row.accountLinkId;
  entity.email = row.email;
  entity.passwordHash = row.passwordHash;
  entity.name = row.name;
  entity.type = row.type === "team" ? "team" : "owner";
  entity.username = row.username?.trim().toLowerCase() ?? null;
  entity.cfAccountId = row.cfAccountId?.trim().toLowerCase() ?? null;
  entity.workerUrl = row.workerUrl?.trim() ?? null;
  entity.passtokenEnc = row.passtokenEnc ?? null;
  entity.createdAt = parseDateRequired(row.createdAt);
  entity.updatedAt = parseDateRequired(row.updatedAt);
  return entity;
}

function toRefreshEntity(row: HqRefreshTokenRecord): HqRefreshTokenEntity {
  const entity = new HqRefreshTokenEntity();
  entity.id = row.id;
  entity.tokenHash = row.tokenHash;
  entity.userId = row.userId;
  entity.expiresAt = parseDateRequired(row.expiresAt);
  entity.createdAt = parseDateRequired(row.createdAt);
  entity.userAgent = row.userAgent;
  entity.ip = row.ip;
  return entity;
}

function toResetEntity(row: HqPasswordResetTokenRecord): HqPasswordResetTokenEntity {
  const entity = new HqPasswordResetTokenEntity();
  entity.id = row.id;
  entity.tokenHash = row.tokenHash;
  entity.userId = row.userId;
  entity.expiresAt = parseDateRequired(row.expiresAt);
  entity.createdAt = parseDateRequired(row.createdAt);
  entity.used = row.used;
  return entity;
}

export async function saveAuthUser(user: HqAuthUser): Promise<void> {
  await authRepos.user().save(toUserEntity(user));
}

export async function saveRefreshToken(record: HqRefreshTokenRecord): Promise<void> {
  await authRepos.refreshToken().save(toRefreshEntity(record));
}

export async function deleteRefreshTokenById(id: string): Promise<void> {
  await authRepos.refreshToken().delete({ id });
}

export async function deleteRefreshTokensForUser(userId: string): Promise<void> {
  await authRepos.refreshToken().delete({ userId });
}

export async function savePasswordResetToken(record: HqPasswordResetTokenRecord): Promise<void> {
  await authRepos.passwordResetToken().save(toResetEntity(record));
}

export async function markPasswordResetTokenUsed(id: string): Promise<void> {
  await authRepos.passwordResetToken().update({ id }, { used: true });
}
