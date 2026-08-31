import {
  buildDefaultWorkerUrl,
  isValidWorkerUrl,
  normalizeWorkerUrl,
} from "../../../lib/desktop/worker-url/worker-url";

export function shellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Accept a workers.dev slug or a full https Worker URL. */
export function resolveManualWorkerUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (isValidWorkerUrl(trimmed)) return normalizeWorkerUrl(trimmed);
  return buildDefaultWorkerUrl(trimmed);
}

export function workerUrlForCommand(raw: string): string {
  return (
    resolveManualWorkerUrl(raw) ||
    "https://relaybase-api.<subdomain>.workers.dev"
  );
}

/** Install Wrangler and log in. Node.js 20+ required. */
export function buildWranglerInstallCommand(): string {
  return [
    `npm install -g wrangler`,
    `npx wrangler login`,
    `npx wrangler whoami`,
  ].join("\n");
}

export function workerUpdateCommand(zipUrl: string): string {
  return [
    `curl -L -o relaybase-worker-install.zip ${shellSingleQuote(zipUrl)}`,
    `unzip -o relaybase-worker-install.zip -d relaybase-worker-install`,
    `cd relaybase-worker-install/relaybase-worker-install || cd relaybase-worker-install`,
    `npx wrangler deploy`,
  ].join("\n");
}

/** Download, secrets, deploy. Overwrites Worker `relaybase-api`. */
export function buildWorkerInstallCommand(opts: {
  pepper: string;
  zipUrl: string;
  accountId?: string;
}): string {
  const pepperQuoted = shellSingleQuote(opts.pepper);
  const zipQuoted = shellSingleQuote(opts.zipUrl);
  const lines = [
    `curl -L -o relaybase-worker-install.zip ${zipQuoted}`,
    `unzip -o relaybase-worker-install.zip -d relaybase-worker-install`,
    `cd relaybase-worker-install/relaybase-worker-install || cd relaybase-worker-install`,
    `printf '%s' ${pepperQuoted} | npx wrangler secret put AUTH_PEPPER`,
  ];
  const accountId = opts.accountId?.trim() ?? "";
  if (accountId) {
    lines.push(
      `printf '%s' ${shellSingleQuote(accountId)} | npx wrangler secret put CF_ACCOUNT_ID`,
    );
  } else {
    lines.push(`# Optional: CF_ACCOUNT_ID for domain API`);
    lines.push(
      `# printf '%s' '<account-id>' | npx wrangler secret put CF_ACCOUNT_ID`,
    );
  }
  lines.push(
    `# Add CF_API_TOKEN (Email Sending / Routing / Zone Read) in the Cloudflare dashboard — do not paste it here.`,
  );
  lines.push(`npx wrangler deploy`);
  return lines.join("\n");
}

/** Create or bind D1/R2, then init-db. Does not delete existing storage. */
export function buildStorageInitCommand(opts: {
  pepper: string;
  workerUrl: string;
}): string {
  const escaped = opts.pepper.replace(/'/g, `'\\''`);
  const workerUrl = workerUrlForCommand(opts.workerUrl);
  return [
    `cd relaybase-worker-install/relaybase-worker-install || cd relaybase-worker-install`,
    `npx wrangler r2 bucket create relaybase-mailbox`,
    `npx wrangler d1 create relaybase-logs`,
    `npx wrangler d1 create relaybase-mail`,
    `npx wrangler d1 create relaybase-db`,
    `# paste each database_id into wrangler.toml (REPLACE_WITH_* placeholders)`,
    `npx wrangler deploy`,
    `curl -X POST ${workerUrl}/console/init-db -H 'X-Auth-Pepper: ${escaped}' -H 'Content-Type: application/json' -d '{}'`,
  ].join("\n");
}

/** Optional liveness check after deploy. */
export function buildVerifyCommand(workerUrl: string): string {
  return `curl -sf ${workerUrlForCommand(workerUrl)}/health`;
}
