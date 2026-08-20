import { sha256Hex } from "./crypto";
import type { AppDb } from "../../db/app";
import {
  createAuthTokenRow as dbCreateAuthTokenRow,
  findAuthTokenByHash as dbFindAuthTokenByHash,
  listAuthTokens as dbListAuthTokens,
  revokeAuthTokenRow as dbRevokeAuthTokenRow,
} from "../../db/app/auth-tokens";

const AUTH_TOKEN_PREFIX = "rb-auth-";
const LEGACY_AUTH_TOKEN_PREFIX = "rb-admin-";
const TOKEN_PREFIX_LENGTH = 8;

export type AuthTokenRecord = {
  id: string;
  label: string | null;
  productId: string | null;
  tokenPrefix: string;
  createdAt: string;
};

function stripAuthTokenPrefix(token: string): string {
  if (token.startsWith(AUTH_TOKEN_PREFIX)) {
    return token.slice(AUTH_TOKEN_PREFIX.length);
  }
  if (token.startsWith(LEGACY_AUTH_TOKEN_PREFIX)) {
    return token.slice(LEGACY_AUTH_TOKEN_PREFIX.length);
  }
  return token;
}

function authTokenPrefix(token: string): string {
  const stripped = stripAuthTokenPrefix(token);
  return stripped.slice(0, TOKEN_PREFIX_LENGTH);
}

export function isValidAuthTokenFormat(token: string): boolean {
  const trimmed = token.trim();
  if (!trimmed.startsWith(AUTH_TOKEN_PREFIX) && !trimmed.startsWith(LEGACY_AUTH_TOKEN_PREFIX)) {
    return false;
  }
  return stripAuthTokenPrefix(trimmed).length > TOKEN_PREFIX_LENGTH;
}

function generateAuthToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${AUTH_TOKEN_PREFIX}${hex}`;
}

export async function createAuthToken(
  db: AppDb,
  params: { label?: string | null; productId?: string | null },
): Promise<{ record: AuthTokenRecord; token: string }> {
  const token = generateAuthToken();
  const tokenHash = await sha256Hex(token);
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const tokenPrefix = authTokenPrefix(token);

  await dbCreateAuthTokenRow(db, {
    id,
    tokenHash,
    label: params.label?.trim() || null,
    productId: params.productId?.trim() || null,
    tokenPrefix,
  });

  return {
    record: {
      id,
      label: params.label?.trim() || null,
      productId: params.productId?.trim() || null,
      tokenPrefix,
      createdAt,
    },
    token,
  };
}

export async function listAuthTokens(db: AppDb): Promise<AuthTokenRecord[]> {
  return dbListAuthTokens(db);
}

export async function findAuthToken(
  db: AppDb,
  token: string,
): Promise<AuthTokenRecord | null> {
  if (!isValidAuthTokenFormat(token)) return null;
  const tokenHash = await sha256Hex(token.trim());
  return dbFindAuthTokenByHash(db, tokenHash);
}

export async function revokeAuthToken(
  db: AppDb,
  id: string,
): Promise<boolean> {
  return dbRevokeAuthTokenRow(db, id);
}
