"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { BroadcastComposeForm } from "@/console/pages/broadcasts/BroadcastComposeForm";
import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import { useBroadcast } from "@/lib/dashboard/BroadcastContext";
import {
  clearBroadcastDetailCache,
  useBroadcastDetail,
} from "@/console/pages/broadcasts/BroadcastDetailContext";
import { broadcastDetailHref, useDashboardPaths } from "@/console/lib/paths";
import { useEmailPaths } from "@/email/lib/paths";
import { fetchEmailCachedOptional } from "@/email/components/mailbox/email-cached-fetch";
import { readEmailStale } from "@/email/components/mailbox/useEmailViewLoading";
import { scheduleEmailSend } from "@/email/components/compose/email-pending-send";
import { EmailAlerts } from "@/email/components/mailbox/EmailShared";
import type { Address, AudienceGroupSummary } from "@/email/components/mailbox/types";
import {
  desktopAwareFetch,
  friendlyDesktopFetchError,
  readResponseJson,
} from "@/lib/desktop/api-base";

import { Button } from "@/components/ui/button";

function domainsForGroups(groups: AudienceGroupSummary[]): Set<string> {
  return new Set(
    groups.map((g) => g.domain?.toLowerCase()).filter((d): d is string => Boolean(d)),
  );
}

/** Prefer each group's Settings → default sender, else first address on those domains. */
function pickDefaultFrom(
  groups: AudienceGroupSummary[],
  domainAddresses: Address[],
): string {
  for (const group of groups) {
    const preferred = group.defaultFrom?.trim().toLowerCase();
    if (!preferred) continue;
    const match = domainAddresses.find(
      (a) => a.email.toLowerCase() === preferred,
    );
    if (match) return match.email;
  }
  return domainAddresses[0]?.email ?? "";
}

export function BroadcastDraftView() {
  const productId = useProductId();
  const { apiBase } = useEmailPaths();
  const { broadcasts } = useDashboardPaths();
  const router = useRouter();
  const broadcastStore = useBroadcast();
  const { broadcastId, detail, loading, refresh } = useBroadcastDetail();

  const [allGroups, setAllGroups] = useState<AudienceGroupSummary[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [from, setFrom] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const job = broadcastStore.jobFor(broadcastId);
  const broadcasting = broadcastStore.isActive(broadcastId);

  useEffect(() => {
    const staleGroups = readEmailStale<{ groups?: AudienceGroupSummary[] }>(
      productId,
      "audience-groups",
    );
    if (staleGroups) setAllGroups(staleGroups.groups ?? []);
    const staleAddresses = readEmailStale<{ addresses?: Address[] }>(
      productId,
      "addresses:all",
    );
    if (staleAddresses) setAddresses(staleAddresses.addresses ?? []);

    void fetchEmailCachedOptional<{ groups?: AudienceGroupSummary[] }>(
      productId,
      "audience-groups",
      `${apiBase}/audience-groups`,
      { onUpdate: (data) => setAllGroups(data?.groups ?? []) },
    ).then((r) => {
      if (r.ok) setAllGroups(r.data?.groups ?? []);
    });
    void fetchEmailCachedOptional<{ addresses?: Address[] }>(
      productId,
      "addresses:all",
      `${apiBase}/addresses?all=1`,
      { onUpdate: (data) => setAddresses(data?.addresses ?? []) },
    ).then((r) => {
      if (r.ok) setAddresses(r.data?.addresses ?? []);
    });
  }, [apiBase, productId]);

  useEffect(() => {
    if (!detail || hydrated) return;
    const local = broadcastStore.getDraft(broadcastId);
    const src = local ?? detail.broadcast;
    setSelectedGroupIds(src.groupIds);
    setFrom(src.from ?? "");
    setSubject(src.subject ?? "");
    setBody(src.body ?? "");
    setHydrated(true);
  }, [broadcastId, broadcastStore, detail, hydrated]);

  const selectedGroups = useMemo(() => {
    const fromDetail = detail?.groups ?? [];
    if (fromDetail.length > 0) {
      const wanted = new Set(selectedGroupIds);
      const matched = fromDetail.filter((g) => wanted.has(g.id));
      if (matched.length > 0) return matched;
    }
    const wanted = new Set(selectedGroupIds);
    return allGroups.filter((g) => wanted.has(g.id));
  }, [allGroups, detail?.groups, selectedGroupIds]);

  const domainAddresses = useMemo(() => {
    const domains = domainsForGroups(selectedGroups);
    if (domains.size === 0) return [];
    return addresses.filter((a) => {
      const domain =
        a.domain ?? a.email.split("@")[1]?.toLowerCase() ?? "";
      return domain !== "" && domains.has(domain.toLowerCase());
    });
  }, [addresses, selectedGroups]);

  // Keep From on the audience domain(s); prefer group default sender.
  // Re-sync casing to the address book entry so Select value matches items.
  useEffect(() => {
    if (!hydrated || domainAddresses.length === 0) return;
    if (from) {
      const match = domainAddresses.find(
        (a) => a.email.toLowerCase() === from.toLowerCase(),
      );
      if (match) {
        if (match.email !== from) setFrom(match.email);
        return;
      }
    }
    setFrom(pickDefaultFrom(selectedGroups, domainAddresses));
  }, [domainAddresses, from, hydrated, selectedGroups]);

  useEffect(() => {
    if (job?.phase === "failed" && job.error) {
      setError(job.error);
    }
  }, [job?.error, job?.phase]);

  async function saveDraft(opts?: { quiet?: boolean }) {
    if (!opts?.quiet) setSaving(true);
    setError(null);
    try {
      const resolvedFrom =
        from.trim() || pickDefaultFrom(selectedGroups, domainAddresses);
      if (!resolvedFrom) {
        throw new Error("Choose a From address before saving");
      }
      if (resolvedFrom !== from) setFrom(resolvedFrom);

      const res = await desktopAwareFetch(
        `${apiBase}/broadcasts/${encodeURIComponent(broadcastId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            groupIds: selectedGroupIds,
            from: resolvedFrom,
            subject,
            text: body,
          }),
        },
      );
      const data = await readResponseJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Failed to save draft");
      clearBroadcastDetailCache(productId, broadcastId);
      await refresh(true);
      if (!opts?.quiet) setDraftStatus("Draft saved");
      return true;
    } catch (e) {
      setError(friendlyDesktopFetchError(e, "Failed to save draft"));
      return false;
    } finally {
      if (!opts?.quiet) setSaving(false);
    }
  }

  function broadcastNow() {
    setError(null);
    setDraftStatus(null);

    const resolvedFrom =
      from.trim() || pickDefaultFrom(selectedGroups, domainAddresses);
    if (!resolvedFrom) {
      setError("Choose a From address before broadcasting.");
      return;
    }
    if (!subject.trim()) {
      setError("Add a subject before broadcasting.");
      return;
    }
    if (selectedGroupIds.length === 0) {
      setError("Select at least one audience group.");
      return;
    }
    if (resolvedFrom !== from) setFrom(resolvedFrom);

    const payload = {
      broadcastId,
      groupIds: selectedGroupIds,
      from: resolvedFrom,
      subject,
      body,
    };
    broadcastStore.armBroadcast(payload);
    router.replace(broadcastDetailHref(broadcastId, "progress"));
    scheduleEmailSend({
      onUnsend: () => {
        broadcastStore.cancelArmed(broadcastId);
        router.replace(broadcastDetailHref(broadcastId));
      },
      execute: () => {
        broadcastStore.queueBroadcast(payload);
      },
    });
  }

  if (loading && !detail) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!detail) return null;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <DesktopTitleBar className="px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2"
            nativeButton={false}
            render={<Link href={broadcasts} />}
          >
            <ArrowLeft className="size-4" />
            Broadcasts
          </Button>
          <h1 className="truncate text-sm font-semibold">Draft broadcast</h1>
        </div>
      </DesktopTitleBar>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-4">
        <EmailAlerts
          error={error}
          message={null}
          onDismissError={() => setError(null)}
        />
        {domainAddresses.length === 0 && selectedGroups.length > 0 ? (
          <p className="mb-3 text-xs text-muted-foreground">
            No sender accounts on{" "}
            {Array.from(domainsForGroups(selectedGroups)).join(", ") ||
              "this domain"}
            . Add an address under Accounts for that domain, or set a default
            sender in the audience group Settings.
          </p>
        ) : null}
        <BroadcastComposeForm
          sendFrom={from}
          setSendFrom={setFrom}
          addresses={domainAddresses}
          groups={allGroups.length > 0 ? allGroups : (detail.groups ?? [])}
          selectedGroupIds={selectedGroupIds}
          subject={subject}
          setSubject={setSubject}
          body={body}
          setBody={setBody}
          broadcasting={broadcasting}
          saving={saving}
          draftStatus={draftStatus}
          onSaveDraft={() => void saveDraft()}
          onBroadcast={() => broadcastNow()}
        />
      </div>
    </div>
  );
}
