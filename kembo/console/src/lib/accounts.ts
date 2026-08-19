import { hashPassword, randomToken, sha256Hex, verifyPassword } from "./crypto";

export type Account = {
  id: string;
  email: string;
  createdAt: string;
  emailVerifiedAt: string | null;
};

type AccountRow = {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
  email_verified_at: string | null;
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
    createdAt: row.created_at,
    emailVerifiedAt: row.email_verified_at,
  };
}

export async function createAccount(
  db: D1Database,
  email: string,
  password: string,
): Promise<Account> {
  const normalized = email.trim().toLowerCase();
  if (!isValidEmail(normalized)) throw new Error("Invalid email");
  if (password.length < 8) throw new Error("Password must be at least 8 characters");

  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password);

  try {
    await db
      .prepare(
        "INSERT INTO accounts (id, email, password_hash) VALUES (?, ?, ?)",
      )
      .bind(id, normalized, passwordHash)
      .run();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("UNIQUE") || msg.toLowerCase().includes("constraint")) {
      throw new Error("An account with this email already exists");
    }
    throw err;
  }

  const row = await db
    .prepare("SELECT id, email, created_at, email_verified_at FROM accounts WHERE id = ?")
    .bind(id)
    .first<AccountRow>();
  if (!row) throw new Error("Account creation failed");
  return rowToAccount(row);
}

export async function getAccountByEmail(
  db: D1Database,
  email: string,
): Promise<AccountRow | null> {
  const normalized = email.trim().toLowerCase();
  return db
    .prepare(
      "SELECT id, email, password_hash, created_at, email_verified_at FROM accounts WHERE email = ?",
    )
    .bind(normalized)
    .first<AccountRow>();
}

export async function getAccountById(
  db: D1Database,
  id: string,
): Promise<AccountRow | null> {
  return db
    .prepare(
      "SELECT id, email, password_hash, created_at, email_verified_at FROM accounts WHERE id = ?",
    )
    .bind(id)
    .first<AccountRow>();
}

export async function verifyAccountCredentials(
  db: D1Database,
  email: string,
  password: string,
): Promise<AccountRow | null> {
  const row = await getAccountByEmail(db, email);
  if (!row) return null;
  const ok = await verifyPassword(password, row.password_hash);
  return ok ? row : null;
}

export async function setAccountPassword(
  db: D1Database,
  accountId: string,
  password: string,
): Promise<void> {
  if (password.length < 8) throw new Error("Password must be at least 8 characters");
  const passwordHash = await hashPassword(password);
  await db
    .prepare("UPDATE accounts SET password_hash = ? WHERE id = ?")
    .bind(passwordHash, accountId)
    .run();
}

export async function registerWorker(
  db: D1Database,
  accountId: string,
  workerUrl: string,
): Promise<void> {
  const url = workerUrl.trim().replace(/\/$/, "");
  if (!/^https:\/\/[a-z0-9.-]+\.workers\.dev$/i.test(url)) {
    throw new Error("Worker URL must be an https://*.workers.dev URL");
  }
  await db
    .prepare(
      `INSERT INTO account_workers (account_id, worker_url) VALUES (?, ?)
       ON CONFLICT(account_id, worker_url) DO NOTHING`,
    )
    .bind(accountId, url)
    .run();
}

export async function listAccountWorkers(
  db: D1Database,
  accountId: string,
): Promise<string[]> {
  const result = await db
    .prepare("SELECT worker_url FROM account_workers WHERE account_id = ? ORDER BY registered_at")
    .bind(accountId)
    .all<{ worker_url: string }>();
  return (result.results ?? []).map((r) => r.worker_url);
}

// --- Recovery tokens (password reset + admin-token recovery) ---

export type RecoveryPurpose = "password" | "admin_token";

export async function createRecoveryToken(
  db: D1Database,
  accountId: string,
  purpose: RecoveryPurpose,
  ttlSeconds: number,
): Promise<string> {
  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  await db
    .prepare(
      "INSERT INTO account_recovery (token_hash, account_id, purpose, expires_at) VALUES (?, ?, ?, ?)",
    )
    .bind(tokenHash, accountId, purpose, expiresAt)
    .run();
  return token;
}

export async function consumeRecoveryToken(
  db: D1Database,
  token: string,
  purpose: RecoveryPurpose,
): Promise<string | null> {
  const tokenHash = await sha256Hex(token);
  const row = await db
    .prepare(
      `SELECT account_id, expires_at, consumed_at FROM account_recovery
       WHERE token_hash = ? AND purpose = ?`,
    )
    .bind(tokenHash, purpose)
    .first<{ account_id: string; expires_at: string; consumed_at: string | null }>();
  if (!row) return null;
  if (row.consumed_at) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  await db
    .prepare("UPDATE account_recovery SET consumed_at = ? WHERE token_hash = ?")
    .bind(new Date().toISOString(), tokenHash)
    .run();
  return row.account_id;
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
