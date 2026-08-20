"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import { broadcastDetailHref } from "@/dashboard/paths";
import { useEmailPaths } from "@/email/lib/paths";
import { fetchEmailCached } from "@/email/components/mailbox/email-cached-fetch";
import { readEmailStale } from "@/email/components/mailbox/useEmailViewLoading";
import { useAudienceGroupDetail } from "@/dashboard/components/AudienceGroupDetailContext";
import { EmailAlerts } from "@/email/components/mailbox/EmailShared";
import {
  EmailListContainer,
  EmailTableHeader,
  EmailTableRow,
  EmptyListState,
} from "@/email/components/mailbox/EmailListShell";
import type { EmailBroadcast } from "@/email/components/mailbox/types";

import { Badge } from "@/components/ui/badge";

const RESOURCE = "broadcasts:all";

export function AudienceGroupHistoryView() {
  const productId = useProductId();
  const { apiBase } = useEmailPaths();
  const router = useRouter();
  const { groupId } = useAudienceGroupDetail();

  const [broadcasts, setBroadcasts] = useState<EmailBroadcast[]>([]);
  const [loading, setLoading] = useState(
    () =>
      readEmailStale<{ broadcasts?: EmailBroadcast[] }>(productId, RESOURCE) ===
      null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stale = readEmailStale<{ broadcasts?: EmailBroadcast[] }>(
      productId,
      RESOURCE,
    );
    if (stale) {
      setBroadcasts(stale.broadcasts ?? []);
      setLoading(false);
    }

    (async () => {
      try {
        const result = await fetchEmailCached<{
          broadcasts?: EmailBroadcast[];
        }>(productId, RESOURCE, `${apiBase}/broadcasts`, {
          onUpdate: (data) => setBroadcasts(data.broadcasts ?? []),
        });
        setBroadcasts(result.data.broadcasts ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load history");
      } finally {
        setLoading(false);
      }
    })();
  }, [apiBase, productId]);

  const scoped = broadcasts.filter((b) => b.groupIds?.includes(groupId));

  return (
    <div className="space-y-4">
      <EmailAlerts
        error={error}
        message={null}
        onDismissError={() => setError(null)}
      />
      <EmailListContainer>
        {scoped.length > 0 ? (
          <>
            <EmailTableHeader>
              <span>Subject</span>
              <span className="hidden sm:block">From</span>
              <span />
              <span className="text-right">Status</span>
            </EmailTableHeader>
            <div>
              {scoped.map((b) => (
                <EmailTableRow
                  key={b.id}
                  onClick={() =>
                    router.push(broadcastDetailHref(b.id))
                  }
                  primary={b.subject?.trim() || "Untitled draft"}
                  subject={b.from || ""}
                  preview={
                    b.recipientCount != null
                      ? `${b.recipientCount} recipients`
                      : undefined
                  }
                  date={new Date(
                    b.sentAt || b.createdAt,
                  ).toLocaleDateString()}
                  status={
                    <Badge
                      variant={b.status === "sent" ? "default" : "secondary"}
                      className="text-[10px] capitalize"
                    >
                      {b.status}
                    </Badge>
                  }
                />
              ))}
            </div>
          </>
        ) : !loading ? (
          <EmptyListState
            title="No broadcasts yet"
            description="Broadcasts sent to this group will show up here."
          />
        ) : (
          <div className="min-h-[200px]" />
        )}
      </EmailListContainer>
    </div>
  );
}
