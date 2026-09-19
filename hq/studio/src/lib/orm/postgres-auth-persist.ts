import type { EntityTarget, ObjectLiteral, Repository } from "typeorm";

import type { HqAuthStore } from "@db/auth-types";
import { getStudioDataSource } from "@lib/orm/data-source";
import {
  HqAuthUserEntity,
  HqPasswordResetTokenEntity,
  HqRefreshTokenEntity,
} from "@db/entities/auth.entities";
import { parseDate, parseDateRequired } from "@lib/db/parse-date";

const CHUNK = 400;

async function saveChunked<T extends ObjectLiteral>(repo: Repository<T>, rows: T[]): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK) {
    await repo.save(rows.slice(i, i + CHUNK));
  }
}

function iso(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString();
}

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

export async function persistAuthStoreToPostgres(auth: HqAuthStore): Promise<void> {
  const dataSource = getStudioDataSource();
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    await queryRunner.query(
      `TRUNCATE TABLE "hq_password_reset_tokens", "hq_refresh_tokens", "hq_auth_users" RESTART IDENTITY CASCADE`,
    );

    const repo = <T extends ObjectLiteral>(entity: EntityTarget<T>) =>
      queryRunner.manager.getRepository(entity);

    const userRows = auth.users.map((row) => {
      const entity = new HqAuthUserEntity();
      entity.id = row.id;
      entity.accountLinkId = row.accountLinkId;
      entity.email = row.email;
      entity.passwordHash = row.passwordHash;
      entity.name = row.name;
      entity.username = row.username?.trim().toLowerCase() ?? null;
      entity.cfAccountId = row.cfAccountId?.trim().toLowerCase() ?? null;
      entity.workerUrl = row.workerUrl?.trim() ?? null;
      entity.passtokenEnc = row.passtokenEnc ?? null;
      entity.createdAt = parseDateRequired(row.createdAt);
      entity.updatedAt = parseDateRequired(row.updatedAt);
      return entity;
    });
    await saveChunked(repo(HqAuthUserEntity), userRows);

    const refreshRows = auth.refreshTokens.map((row) => {
      const entity = new HqRefreshTokenEntity();
      entity.id = row.id;
      entity.tokenHash = row.tokenHash;
      entity.userId = row.userId;
      entity.expiresAt = parseDateRequired(row.expiresAt);
      entity.createdAt = parseDateRequired(row.createdAt);
      entity.userAgent = row.userAgent;
      entity.ip = row.ip;
      return entity;
    });
    await saveChunked(repo(HqRefreshTokenEntity), refreshRows);

    const resetRows = auth.passwordResetTokens.map((row) => {
      const entity = new HqPasswordResetTokenEntity();
      entity.id = row.id;
      entity.tokenHash = row.tokenHash;
      entity.userId = row.userId;
      entity.expiresAt = parseDateRequired(row.expiresAt);
      entity.createdAt = parseDateRequired(row.createdAt);
      entity.used = row.used;
      return entity;
    });
    await saveChunked(repo(HqPasswordResetTokenEntity), resetRows);

    await queryRunner.commitTransaction();
  } catch (err) {
    await queryRunner.rollbackTransaction();
    throw err;
  } finally {
    await queryRunner.release();
  }
}
