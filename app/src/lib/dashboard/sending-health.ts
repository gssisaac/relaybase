export type SendingHealthStatus =
  | "ready"
  | "restricted"
  | "no_zone"
  | "unknown";

export type SendingHealthDomain = {
  domain: string;
  status: SendingHealthStatus;
  sendingEnabled: boolean;
  sendingOnboarded: boolean;
  zoneId: string | null;
  error: string | null;
  /** Present when CF entitlement blocked sending (e.g. `cf_workers_paid_required`). */
  code?: string | null;
  cloudflareSendingUrl: string | null;
};

export type SendingHealthSnapshot = {
  generatedAt: string;
  domains: SendingHealthDomain[];
};

export function domainFromEmail(email: string): string {
  return email.split("@")[1]?.trim().toLowerCase() ?? "";
}

export function statusForDomain(
  snapshot: SendingHealthSnapshot | null,
  domain: string,
): SendingHealthDomain | null {
  const needle = domain.trim().toLowerCase();
  if (!needle || !snapshot) return null;
  return snapshot.domains.find((entry) => entry.domain === needle) ?? null;
}

export function statusForEmail(
  snapshot: SendingHealthSnapshot | null,
  email: string,
): SendingHealthDomain | null {
  return statusForDomain(snapshot, domainFromEmail(email));
}

export function isSendingWarningStatus(
  status: SendingHealthStatus | null | undefined,
): boolean {
  return status === "restricted" || status === "no_zone";
}

export function sendingBadgeLabel(status: SendingHealthStatus): string {
  switch (status) {
    case "ready":
      return "Ready";
    case "restricted":
      return "Restricted";
    case "no_zone":
      return "No zone";
    case "unknown":
      return "Can't check";
  }
}

export type SendingWarningAudience = "owner" | "team";

const TEAM_RESTRICTED =
  "This mailbox cannot send to other Relaybase addresses yet. Ask the owner to finish Email Sending setup.";
const TEAM_NO_ZONE =
  "This domain is not set up for sending yet. Ask the owner to add it.";
const TEAM_FALLBACK =
  "Sending is not ready for this mailbox. Ask the owner for help.";
const OWNER_FALLBACK =
  "Email Sending is not ready for this domain. Cloudflare only delivers to verified destination addresses until the domain is onboarded.";

/** Mail-mode copy. Team users never get Cloudflare dashboard instructions. */
export function sendingWarningDescription(
  status: SendingHealthStatus,
  audience: SendingWarningAudience,
  serverError?: string | null,
): string {
  if (audience === "team") {
    if (status === "no_zone") return TEAM_NO_ZONE;
    if (status === "restricted") return TEAM_RESTRICTED;
    return TEAM_FALLBACK;
  }
  const raw = serverError?.trim() ?? "";
  return raw || OWNER_FALLBACK;
}

export function showSendingCloudflareLink(
  audience: SendingWarningAudience,
  url: string | null | undefined,
): boolean {
  return audience === "owner" && Boolean(url);
}
