"use client";

import { useDomain } from "@/lib/dashboard/DomainContext";
import { useEmailMailbox } from "@/relaybase-email/components/EmailMailboxContext";
import type { EmailMailboxSection } from "@/relaybase-email/components/EmailMailboxLayout";
import {
  EmailAlerts,
  InboundR2ConfigAlert,
  NoDomainsAlert,
  RelaybaseConfigAlert,
} from "@/relaybase-email/components/EmailShared";

export function EmailMailboxAlerts({
  section,
}: {
  section: EmailMailboxSection;
}) {
  const { domains, loading } = useDomain();
  const { config, error, message } = useEmailMailbox();

  const showNoDomains = !loading && domains.length === 0;
  const showRelaybase = Boolean(config) && !config?.relaybaseConfigured;
  const showInbound = section === "inbox" && Boolean(config);
  const hasContent = showNoDomains || Boolean(error) || Boolean(message) || showRelaybase || showInbound;

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
