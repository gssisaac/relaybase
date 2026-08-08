"use client";

import { useDomain } from "@/lib/dashboard/DomainContext";
import { useEmailMailbox } from "@/email/components/EmailMailboxContext";
import type { EmailMailboxSection } from "@/email/components/EmailMailboxLayout";
import {
  EmailAlerts,
  InboundR2ConfigAlert,
  NoDomainsAlert,
  RelaybaseConfigAlert,
} from "@/email/components/EmailShared";

export function EmailMailboxAlerts({
  section,
  surface = "email",
}: {
  section: EmailMailboxSection;
  /** Dashboard shows setup/infra alerts; email only shows mail operation status. */
  surface?: "email" | "dashboard";
}) {
  const { domains, loading } = useDomain();
  const { config, error, message } = useEmailMailbox();

  const showInfra = surface === "dashboard";
  const showNoDomains = showInfra && !loading && domains.length === 0;
  const showRelaybase =
    showInfra && Boolean(config) && !config?.relaybaseConfigured;
  const showInbound =
    showInfra &&
    section === "inbox" &&
    !!config &&
    !config.inboundR2Configured;
  const hasContent =
    showNoDomains ||
    Boolean(error) ||
    Boolean(message) ||
    showRelaybase ||
    showInbound;

  if (!hasContent) return null;

  return (
    <div className="shrink-0 space-y-3 border-b border-border px-4 py-3">
      <NoDomainsAlert show={showNoDomains} />
      <EmailAlerts error={error} message={message} />
      <RelaybaseConfigAlert show={showRelaybase} />
      {showInbound ? <InboundR2ConfigAlert config={config} /> : null}
    </div>
  );
}
