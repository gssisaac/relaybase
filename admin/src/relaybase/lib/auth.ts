import {
  requireEmailSenderConfig,
  resolveWorkerServiceToken,
  resolveEmailSenderConfig,
  type EmailSenderConfig,
} from "./config";
import {
  findRelaybaseDashboardAuthToken,
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
  return readEmailSenderSettings().workerUrl.trim();
}

export class RelaybaseAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RelaybaseAuthError";
  }
}

function isDashboardAuthToken(token: string): boolean {
  return findRelaybaseDashboardAuthToken(token) !== null;
}

function resolveWorkerServiceTokenForCalls(): string {
  const configured = resolveWorkerServiceToken().trim();
  if (configured) return configured;

  throw new RelaybaseAuthError(
    "Relaybase worker is not linked — save Worker URL and Cloudflare credentials in Settings",
  );
}

/** Auth tokens issued from Status — not the internal worker service token. */
export async function resolveRelaybaseAuthCredential(
  token: string,
): Promise<boolean> {
  const trimmed = token.trim();
  if (!trimmed || looksLikeCloudflareApiToken(trimmed)) return false;
  return isDashboardAuthToken(trimmed);
}

/** @deprecated Use resolveRelaybaseAuthCredential */
export const resolveRelaybaseAdminCredential = resolveRelaybaseAuthCredential;

/**
 * Authenticate Relaybase API calls from the product UI.
 */
export async function requireRelaybaseAuth(
  request: Request,
): Promise<EmailSenderConfig> {
  const token = bearerToken(request);

  if (token) {
    if (!(await resolveRelaybaseAuthCredential(token))) {
      throw new RelaybaseAuthError(
        "Invalid Relaybase auth token — use rb-auth-… from Relaybase Admin → Users, not a Cloudflare API token (cfut_…)",
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

/** @deprecated Use requireRelaybaseAuth */
export const requireRelaybaseAdminAuth = requireRelaybaseAuth;

/**
 * Authenticate relaybase-email dashboard calls for a product.
 * Auth tokens authorize the product UI; worker calls use an internal service token.
 */
export async function requireDashboardRelaybaseAuth(
  productId: string,
  request: Request,
): Promise<EmailSenderConfig> {
  const bearer = bearerToken(request);
  const stored = readEmailSettings(productId).relaybaseAuthToken.trim();
  const dashboardToken = bearer || stored;

  if (!dashboardToken) {
    throw new RelaybaseAuthError(
      "Relaybase auth token is required — issue one in Relaybase Admin → Users",
    );
  }

  if (!(await resolveRelaybaseAuthCredential(dashboardToken))) {
    throw new RelaybaseAuthError(
        "Invalid Relaybase auth token — issue a fresh rb-auth-… token in Relaybase Admin → Users. Cloudflare API tokens (cfut_…) are not accepted.",
    );
  }

  const dashboardRecord = findRelaybaseDashboardAuthToken(dashboardToken);
  if (
    dashboardRecord?.productId &&
    dashboardRecord.productId !== productId.trim()
  ) {
    throw new RelaybaseAuthError(
      "This Relaybase auth token is not authorized for this product",
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

/** @deprecated Use requireDashboardRelaybaseAuth */
export const requireDashboardRelaybaseAdminAuth = requireDashboardRelaybaseAuth;
