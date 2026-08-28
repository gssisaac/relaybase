"use client";

import { useDomain } from "@/lib/dashboard/DomainContext";
import { useEmailMailbox } from "@/email/components/mailbox/EmailMailboxContext";
import type { EmailMailboxSection } from "./EmailMailboxLayout";
import {
  EmailAlerts,
  InboundR2ConfigAlert,
  NoDomainsAlert,
  RelaybaseConfigAlert,
} from "../EmailShared";

export function EmailMailboxAlerts({
  section,
  surface = "email",
}: {
  section: EmailMailboxSection;
  /** Dashboard shows setup/infra alerts; email only shows mail operation status. */
  surface?: "email" | "dashboard";
}) {
  const { domains, loading } = useDomain();
  const { config, error, phase } = useEmailMailbox();

  const showInfra = surface === "dashboard";
  const showNoDomains = showInfra && !loading && domains.length === 0;
  const showRelaybase =
    showInfra && Boolean(config) && !config?.relaybaseConfigured;
  const showInbound =
    showInfra &&
    section === "inbox" &&
    !!config &&
    !config.inboundR2Configured;
  const showMailError = phase === "done" && Boolean(error);
  const hasContent =
    showNoDomains ||
    showMailError ||
    showRelaybase ||
    showInbound;

  if (!hasContent) return null;

  return (
    <div className="shrink-0 space-y-3 border-b border-border px-4 py-3">
      <NoDomainsAlert show={showNoDomains} />
      <EmailAlerts error={showMailError ? error : null} message={null} />
      <RelaybaseConfigAlert show={showRelaybase} />
      {showInbound ? <InboundR2ConfigAlert config={config} /> : null}
    </div>
  );
}
