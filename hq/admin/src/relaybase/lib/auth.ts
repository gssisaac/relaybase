import {
  requireEmailSenderConfig,
  type EmailSenderConfig,
} from "./config";

export class RelaybaseAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RelaybaseAuthError";
  }
}

/** HQ no longer verifies dashboard tokens against the product Worker. */
export async function resolveRelaybaseAuthCredential(
  _token: string,
): Promise<boolean> {
  return false;
}

/** @deprecated Use resolveRelaybaseAuthCredential */
export const resolveRelaybaseAdminCredential = resolveRelaybaseAuthCredential;

export async function requireRelaybaseAuth(
  _request: Request,
): Promise<EmailSenderConfig> {
  return requireEmailSenderConfig();
}

/** @deprecated Use requireRelaybaseAuth */
export const requireRelaybaseAdminAuth = requireRelaybaseAuth;

export async function requireDashboardRelaybaseAuth(
  _productId: string,
  _request: Request,
): Promise<EmailSenderConfig> {
  return requireEmailSenderConfig();
}

/** @deprecated Use requireDashboardRelaybaseAuth */
export const requireDashboardRelaybaseAdminAuth = requireDashboardRelaybaseAuth;
