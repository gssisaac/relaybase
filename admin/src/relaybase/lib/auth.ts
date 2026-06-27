import {
  requireEmailSenderConfig,
  resolveAdminTokenFromSettings,
  resolveEmailSenderConfig,
  type EmailSenderConfig,
} from "./config";
import {
  findRelaybaseDashboardAdminToken,
  looksLikeCloudflareApiToken,
  readEmailSenderSettings,
} from "./settings";
import { readEmailSettings } from "@/relaybase-email/lib/email-settings";

function bearerToken(request: Request): string | null {
  const header = request.headers.get("Authorization")?.trim();
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() || null;
}

function resolveWorkerBaseUrl(): string {
  const settings = readEmailSenderSettings();
  return (
    settings.workerUrl.trim() ||
    process.env.RELAYBASE_URL?.trim().replace(/\/$/, "") ||
    process.env.FLARE_EMAIL_SENDER_URL?.trim().replace(/\/$/, "") ||
    ""
  );
}

export class RelaybaseAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RelaybaseAuthError";
  }
}

function isDashboardAccessToken(token: string): boolean {
  return findRelaybaseDashboardAdminToken(token) !== null;
}

function resolveWorkerServiceTokenForCalls(): string {
  const configured = resolveAdminTokenFromSettings().trim();
  if (configured) return configured;

  throw new RelaybaseAuthError(
    "Relaybase worker is not linked — save Worker URL and Cloudflare credentials in Settings",
  );
}

/** Dashboard tokens issued from Status — not the internal worker service token. */
export async function resolveRelaybaseAdminCredential(
  token: string,
): Promise<boolean> {
  const trimmed = token.trim();
  if (!trimmed || looksLikeCloudflareApiToken(trimmed)) return false;
  return isDashboardAccessToken(trimmed);
}

/**
 * Authenticate Relaybase admin API calls from the Relaybase product UI.
 */
export async function requireRelaybaseAdminAuth(
  request: Request,
): Promise<EmailSenderConfig> {
  const token = bearerToken(request);

  if (token) {
    if (!(await resolveRelaybaseAdminCredential(token))) {
      throw new RelaybaseAuthError(
        "Invalid Relaybase admin token — use rb-admin-… from Relaybase Status, not a Cloudflare API token (cfut_…)",
      );
    }
    const baseUrl = resolveWorkerBaseUrl();
    if (!baseUrl) {
      throw new Error(
        "Relaybase worker is not configured — set the worker URL in Relaybase settings",
      );
    }
    const adminToken = resolveWorkerServiceTokenForCalls();
    return { baseUrl, adminToken };
  }

  return requireEmailSenderConfig();
}

/**
 * Authenticate relaybase-email dashboard calls for a product.
 * Dashboard tokens authorize the product UI; worker calls use an internal service token.
 */
export async function requireDashboardRelaybaseAdminAuth(
  productId: string,
  request: Request,
): Promise<EmailSenderConfig> {
  const bearer = bearerToken(request);
  const stored = readEmailSettings(productId).relaybaseAdminToken.trim();
  const dashboardToken = bearer || stored;

  if (!dashboardToken) {
    throw new RelaybaseAuthError(
      "Relaybase admin token is required — issue one in Relaybase → Status and paste it in Email settings",
    );
  }

  if (!(await resolveRelaybaseAdminCredential(dashboardToken))) {
    throw new RelaybaseAuthError(
      "Invalid Relaybase admin token — issue a fresh rb-admin-… token in Relaybase → Status. Cloudflare API tokens (cfut_…) are not accepted.",
    );
  }

  const dashboardRecord = findRelaybaseDashboardAdminToken(dashboardToken);
  if (
    dashboardRecord?.productId &&
    dashboardRecord.productId !== productId.trim()
  ) {
    throw new RelaybaseAuthError(
      "This Relaybase admin token is not authorized for this product",
    );
  }

  const baseUrl = resolveWorkerBaseUrl();
  if (!baseUrl) {
    throw new Error(
      "Relaybase worker is not configured — set the worker URL in Relaybase settings",
    );
  }

  const adminToken = resolveWorkerServiceTokenForCalls();
  return { baseUrl, adminToken };
}
