import { createHmac, timingSafeEqual } from "node:crypto";

export type HqAccessClaims = {
  sub: string;
  email: string;
  accountLinkId: string;
};

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64url");
}

function decodeBase64url(input: string): Buffer {
  return Buffer.from(input, "base64url");
}

export function signAccessToken(
  claims: HqAccessClaims,
  secret: string,
  ttlSeconds: number,
): { token: string; expiresIn: number } {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    ...claims,
    iat: now,
    exp: now + ttlSeconds,
  };
  const body = base64url(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const sig = createHmac("sha256", secret).update(data).digest("base64url");
  return { token: `${data}.${sig}`, expiresIn: ttlSeconds };
}

export function verifyAccessToken(
  token: string,
  secret: string,
): (HqAccessClaims & { exp: number; iat: number }) | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, bodyB64, sigB64] = parts;
  if (!headerB64 || !bodyB64 || !sigB64) return null;

  const data = `${headerB64}.${bodyB64}`;
  const expected = createHmac("sha256", secret).update(data).digest("base64url");
  const sigBuf = decodeBase64url(sigB64);
  const expBuf = decodeBase64url(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  let parsed: HqAccessClaims & { exp?: number; iat?: number };
  try {
    parsed = JSON.parse(decodeBase64url(bodyB64).toString("utf8")) as HqAccessClaims & {
      exp?: number;
      iat?: number;
    };
  } catch {
    return null;
  }

  if (!parsed.sub || !parsed.email || !parsed.accountLinkId) return null;
  const exp = parsed.exp ?? 0;
  if (exp <= Math.floor(Date.now() / 1000)) return null;

  return {
    sub: parsed.sub,
    email: parsed.email,
    accountLinkId: parsed.accountLinkId,
    exp,
    iat: parsed.iat ?? 0,
  };
}
