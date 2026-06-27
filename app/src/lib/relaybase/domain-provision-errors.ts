export type DomainProvisionErrorKind =
  | "validation"
  | "setup"
  | "system";

export class DomainProvisionError extends Error {
  readonly kind: DomainProvisionErrorKind;
  readonly userMessage: string;
  readonly logMessage: string;
  readonly status: number;

  constructor(params: {
    kind: DomainProvisionErrorKind;
    userMessage: string;
    logMessage: string;
    status?: number;
    cause?: unknown;
  }) {
    super(params.logMessage);
    this.name = "DomainProvisionError";
    this.kind = params.kind;
    this.userMessage = params.userMessage;
    this.logMessage = params.logMessage;
    this.status =
      params.status ??
      (params.kind === "validation"
        ? 400
        : params.kind === "setup"
          ? 503
          : 500);
    if (params.cause !== undefined) {
      this.cause = params.cause;
    }
  }
}

export function validationDomainError(message: string): DomainProvisionError {
  return new DomainProvisionError({
    kind: "validation",
    userMessage: message,
    logMessage: message,
    status: 400,
  });
}

export function duplicateDomainError(domain: string): DomainProvisionError {
  const message = `${domain} is already in your domain list.`;
  return new DomainProvisionError({
    kind: "validation",
    userMessage: message,
    logMessage: `Duplicate domain add attempted: ${domain}`,
    status: 409,
  });
}

export function platformNotConfiguredError(): DomainProvisionError {
  return new DomainProvisionError({
    kind: "setup",
    userMessage:
      "Inbound mail storage is not configured yet. Ask your operator to finish Relaybase setup (Cloudflare account and API token), then try again.",
    logMessage: "Relaybase Cloudflare credentials are not configured",
    status: 503,
  });
}

export function classifyProvisionFailure(error: unknown): DomainProvisionError {
  if (error instanceof DomainProvisionError) {
    return error;
  }

  const raw = error instanceof Error ? error.message : String(error);

  if (/valid domain|domain is required|already in your domain/i.test(raw)) {
    return validationDomainError(raw);
  }

  if (/not configured|credentials are not configured/i.test(raw)) {
    return platformNotConfiguredError();
  }

  if (/authentication error|unauthorized|9109|10000|invalid.*token|permission/i.test(raw)) {
    return new DomainProvisionError({
      kind: "setup",
      userMessage:
        "Inbound mail storage could not be set up. Ask your operator to verify Relaybase Cloudflare credentials and R2 permissions, then try adding the domain again.",
      logMessage: `R2 provisioning failed (Cloudflare auth): ${raw}`,
      status: 503,
      cause: error,
    });
  }

  if (/bucket name must|R2 bucket list failed|R2 bucket create failed/i.test(raw)) {
    return new DomainProvisionError({
      kind: "setup",
      userMessage:
        "Inbound mail storage could not be set up. Ask your operator to review the Relaybase R2 bucket configuration.",
      logMessage: `R2 provisioning failed (bucket): ${raw}`,
      status: 503,
      cause: error,
    });
  }

  return new DomainProvisionError({
    kind: "system",
    userMessage:
      "Domain setup failed due to a server error. Please try again later.",
    logMessage: raw,
    status: 500,
    cause: error,
  });
}

export function logDomainProvisionFailure(params: {
  userId: string;
  domain: string;
  error: DomainProvisionError;
}): void {
  console.error("[domain-provision]", {
    userId: params.userId,
    domain: params.domain,
    kind: params.error.kind,
    message: params.error.logMessage,
    cause:
      params.error.cause instanceof Error
        ? params.error.cause.message
        : params.error.cause,
  });
}
