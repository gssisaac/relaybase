import { eq } from "drizzle-orm";
import { hashPassword, randomToken, sha256Hex, verifyPassword } from "./crypto";
import { accounts, accountWorkers, accountRecovery } from "@/db/schema";
import type { Database } from "@/db/client";

export type Account = {
  id: string;
  email: string;
  createdAt: string;
  emailVerifiedAt: string | null;
};

type AccountRow = {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  emailVerifiedAt: string | null;
};

const EMAIL_RE =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export function isValidEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  return e.length <= 320 && EMAIL_RE.test(e);
}

function rowToAccount(row: AccountRow): Account {
  return {
    id: row.id,
    email: row.email,
    createdAt: row.createdAt,
    emailVerifiedAt: row.emailVerifiedAt,
  };
}

function dbRowToAccountRow(row: typeof accounts.$inferSelect): AccountRow {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.passwordHash,
    createdAt: row.createdAt,
    emailVerifiedAt: row.emailVerifiedAt,
  };
}

export async function createAccount(
  db: Database,
  email: string,
  password: string,
): Promise<Account> {
  const normalized = email.trim().toLowerCase();
  if (!isValidEmail(normalized)) throw new Error("Invalid email");
  if (password.length < 8) throw new Error("Password must be at least 8 characters");

  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password);

  try {
    await db.insert(accounts).values({
      id,
      email: normalized,
      passwordHash,
      createdAt: new Date().toISOString(),
      emailVerifiedAt: null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("UNIQUE") || msg.toLowerCase().includes("constraint")) {
      throw new Error("An account with this email already exists");
    }
    throw err;
  }

  const row = await db.select().from(accounts).where(eq(accounts.id, id)).get();
  if (!row) throw new Error("Account creation failed");
  return rowToAccount(dbRowToAccountRow(row));
}

export async function getAccountByEmail(
  db: Database,
  email: string,
): Promise<AccountRow | null> {
  const normalized = email.trim().toLowerCase();
  const row = await db.select().from(accounts).where(eq(accounts.email, normalized)).get();
  return row ? dbRowToAccountRow(row) : null;
}

export async function getAccountById(
  db: Database,
  id: string,
): Promise<AccountRow | null> {
  const row = await db.select().from(accounts).where(eq(accounts.id, id)).get();
  return row ? dbRowToAccountRow(row) : null;
}

export async function verifyAccountCredentials(
  db: Database,
  email: string,
  password: string,
): Promise<AccountRow | null> {
  const row = await getAccountByEmail(db, email);
  if (!row) return null;
  const ok = await verifyPassword(password, row.passwordHash);
  return ok ? row : null;
}

export async function setAccountPassword(
  db: Database,
  accountId: string,
  password: string,
): Promise<void> {
  if (password.length < 8) throw new Error("Password must be at least 8 characters");
  const passwordHash = await hashPassword(password);
  await db.update(accounts).set({ passwordHash }).where(eq(accounts.id, accountId));
}

export async function registerWorker(
  db: Database,
  accountId: string,
  workerUrl: string,
): Promise<void> {
  const url = workerUrl.trim().replace(/\/$/, "");
  if (!/^https:\/\/[a-z0-9.-]+\.workers\.dev$/i.test(url)) {
    throw new Error("Worker URL must be an https://*.workers.dev URL");
  }
  await db.insert(accountWorkers).values({
    accountId,
    workerUrl: url,
    registeredAt: new Date().toISOString(),
  }).onConflictDoNothing();
}

export async function listAccountWorkers(
  db: Database,
  accountId: string,
): Promise<string[]> {
  const rows = await db
    .select({ workerUrl: accountWorkers.workerUrl })
    .from(accountWorkers)
    .where(eq(accountWorkers.accountId, accountId))
    .orderBy(accountWorkers.registeredAt)
    .all();
  return rows.map((r) => r.workerUrl);
}

// --- Recovery tokens (password reset + admin-token recovery) ---

export type RecoveryPurpose = "password" | "admin_token";

export async function createRecoveryToken(
  db: Database,
  accountId: string,
  purpose: RecoveryPurpose,
  ttlSeconds: number,
): Promise<string> {
  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  await db.insert(accountRecovery).values({
    tokenHash,
    accountId,
    purpose,
    expiresAt,
    consumedAt: null,
  });
  return token;
}

export async function consumeRecoveryToken(
  db: Database,
  token: string,
  purpose: RecoveryPurpose,
): Promise<string | null> {
  const tokenHash = await sha256Hex(token);
  const row = await db
    .select()
    .from(accountRecovery)
    .where(eq(accountRecovery.tokenHash, tokenHash))
    .get();
  if (!row) return null;
  if (row.purpose !== purpose) return null;
  if (row.consumedAt) return null;
  if (new Date(row.expiresAt).getTime() < Date.now()) return null;
  await db
    .update(accountRecovery)
    .set({ consumedAt: new Date().toISOString() })
    .where(eq(accountRecovery.tokenHash, tokenHash));
  return row.accountId;
}

// --- Sessions (signed stateless tokens) ---

export type SessionPayload = {
  accountId: string;
  email: string;
  issuedAt: number;
  expiresAt: number;
};

const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

export async function createSession(
  secret: string,
  account: Pick<AccountRow, "id" | "email">,
): Promise<string> {
  const payload: SessionPayload = {
    accountId: account.id,
    email: account.email,
    issuedAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000,
  };
  const body = btoa(JSON.stringify(payload));
  const sig = await sessionSignature(secret, body);
  return `${body}.${sig}`;
}

export async function verifySession(
  secret: string,
  token: string | undefined | null,
): Promise<SessionPayload | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = await sessionSignature(secret, body);
  if (!timingSafeEqualStr(expected, sig)) return null;
  let payload: SessionPayload;
  try {
    payload = JSON.parse(atob(body)) as SessionPayload;
  } catch {
    return null;
  }
  if (payload.expiresAt < Date.now()) return null;
  return payload;
}

async function sessionSignature(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body),
  );
  return Array.from(new Uint8Array(sig), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function sessionCookieName(): string {
  return "relaybase_console_session";
}

export function sessionMaxAgeSeconds(): number {
  return SESSION_TTL_SECONDS;
}
