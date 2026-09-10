export const ADMIN_SESSION_COOKIE = "admin_session";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function getAdminPasskey(): string {
  return process.env.ADMIN_PASSKEY?.trim() ?? "";
}

export function isAdminPasskeyConfigured(): boolean {
  return getAdminPasskey().length > 0;
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacHex(key: string, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(message),
  );
  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

// Fixed-length, no-early-exit comparison so unequal inputs and unequal
// hashes both take the same time — avoids leaking length/content via timing.
function timingSafeEqualHex(a: string, b: string): boolean {
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export async function verifyPasskey(candidate: string): Promise<boolean> {
  const expected = getAdminPasskey();
  if (!expected) return false;
  const [candidateHash, expectedHash] = await Promise.all([
    sha256Hex(candidate.trim()),
    sha256Hex(expected),
  ]);
  return timingSafeEqualHex(candidateHash, expectedHash);
}

export async function createSessionToken(): Promise<string | null> {
  const passkey = getAdminPasskey();
  if (!passkey) return null;
  const expires = String(Date.now() + SESSION_TTL_MS);
  const signature = await hmacHex(passkey, expires);
  return `${expires}.${signature}`;
}

export async function isValidSessionToken(
  token: string | undefined | null,
): Promise<boolean> {
  if (!token) return false;
  const passkey = getAdminPasskey();
  if (!passkey) return false;

  const [expiresRaw, signature] = token.split(".");
  if (!expiresRaw || !signature) return false;

  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;

  const expectedSignature = await hmacHex(passkey, expiresRaw);
  return timingSafeEqualHex(signature, expectedSignature);
}

export const SESSION_COOKIE_MAX_AGE_SECONDS = SESSION_TTL_MS / 1000;
