"use client";

import { useEmailPaths } from "@/relaybase-email/components/useEmailPaths";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  CloudflareConfigAlert,
  EmailAlerts,
  PageToolbar,
  StatusBadge,
} from "@/relaybase-email/components/EmailShared";
import type { EmailSendingLimits } from "@/relaybase-email/components/types";
import { fetchEmailCached } from "@/relaybase-email/components/email-cached-fetch";
import { readEmailStale } from "@/relaybase-email/components/useEmailViewLoading";
import { useEmailSettings } from "@/relaybase-email/components/useEmailSettings";
import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function EmailSettingsLimitsView() {
  const productId = useProductId();
  const { apiBase } = useEmailPaths();
  const s = useEmailSettings();
  const [limits, setLimits] = useState<EmailSendingLimits | null>(null);
  const [loading, setLoading] = useState(
    () => readEmailStale<EmailSendingLimits>(productId, "ses-account") === null,
  );
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const limitsRef = useRef(limits);
  limitsRef.current = limits;

  useEffect(() => {
    const stale = readEmailStale<EmailSendingLimits>(productId, "ses-account");
    if (stale) {
      setLimits(stale);
      setLoading(false);
    }
  }, [productId]);

  const loadLimits = useCallback(
    async (force?: boolean) => {
      const hasData = limitsRef.current !== null;
      if (!hasData) setLoading(true);
      setRefreshing(true);
      setError(null);
      try {
        const { data } = await fetchEmailCached<EmailSendingLimits>(
          productId,
          "ses-account",
          `${apiBase}/ses-account`,
          {
            refresh: force,
            onUpdate: (d) => setLimits(d),
          },
        );
        setLimits(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load limits");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [apiBase, productId],
  );

  useEffect(() => {
    loadLimits();
  }, [loadLimits]);

  return (
    <div className="min-h-[min(70vh,560px)] space-y-4">
      <PageToolbar
        refreshing={refreshing || s.refreshing}
        cacheHint={s.cacheHint}
        onRefresh={() => {
          void s.refresh({ refresh: true });
          void loadLimits(true);
        }}
      />
      <EmailAlerts error={s.error ?? error} message={s.message} />
      <CloudflareConfigAlert show={!s.cloudflareOk} />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Sending limits & status</CardTitle>
          <CardDescription>
            Cloudflare Email Service scales daily sending limits based on
            deliverability. Request higher limits via the{" "}
            <Link
              href="https://developers.cloudflare.com/email-product/platform/limits/"
              className="underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              limit increase form
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {limits ? (
            <>
              <div className="flex flex-wrap gap-2">
                <StatusBadge
                  ok={limits.sendingEnabled}
                  labelOk="Sending enabled"
                  labelBad="Sending not onboarded"
                />
                <StatusBadge
                  ok={limits.routingEnabled}
                  labelOk="Routing enabled"
                  labelBad="Routing not enabled"
                />
              </div>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Domain</dt>
                  <dd className="font-mono">{limits.domain || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Sending subdomains
                  </dt>
                  <dd>{limits.sendingSubdomainCount}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Routing rules
                  </dt>
                  <dd>{limits.routingRuleCount}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Destination addresses
                  </dt>
                  <dd>{limits.destinationAddressCount}</dd>
                </div>
              </dl>
              <p className="text-xs text-muted-foreground">
                Before domain onboarding, you can only send to verified
                destination addresses. Sends to verified destinations do not
                count toward quotas. See{" "}
                <Link
                  href={limits.pricingUrl}
                  className="underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  pricing
                </Link>{" "}
                and{" "}
                <Link
                  href={limits.limitsUrl}
                  className="underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  limits
                </Link>
                .
              </p>
            </>
          ) : !loading ? (
            <p className="text-sm text-muted-foreground">
              Configure Cloudflare credentials and onboard your domain to see
              status.
            </p>
          ) : (
            <div className="min-h-[120px]" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
