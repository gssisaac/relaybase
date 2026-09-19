/** Reject values that are not Cloudflare API tokens before calling the CF API. */
export function validateCfApiTokenInput(raw: string): { ok: true; token: string } | { ok: false; message: string } {
  const token = raw.trim();
  if (!token) {
    return { ok: false, message: "Please enter a Cloudflare API token." };
  }
  if (/\s/.test(token)) {
    return { ok: false, message: "API tokens cannot contain spaces. Paste only the token string from Cloudflare." };
  }
  if (/^https?:\/\//i.test(token) || token.includes("://")) {
    return {
      ok: false,
      message:
        "That looks like a URL, not an API token. Create a token at Cloudflare → My Profile → API Tokens and paste the secret value here.",
    };
  }
  if (token.length < 20) {
    return {
      ok: false,
      message: "This value is too short to be a Cloudflare API token. Paste the full token from the Create Token screen.",
    };
  }
  if (!/^[\x21-\x7E]+$/.test(token)) {
    return {
      ok: false,
      message: "API token contains invalid characters. Paste the token exactly as Cloudflare shows it once.",
    };
  }
  return { ok: true, token };
}

export function cfVerifyTokenErrorMessage(cfBody: {
  errors?: Array<{ code?: number; message?: string }>;
}): string | undefined {
  const err = cfBody.errors?.[0];
  if (!err) return undefined;
  if (err.code === 6111 || err.message?.toLowerCase().includes("invalid format for authorization")) {
    return "That is not a valid Cloudflare API token format. Paste the token secret from API Tokens (not a dashboard URL).";
  }
  if (err.message?.toLowerCase().includes("invalid request headers")) {
    return "Cloudflare rejected the Authorization header. Paste your API token from My Profile → API Tokens, not a website URL.";
  }
  return err.message;
}
