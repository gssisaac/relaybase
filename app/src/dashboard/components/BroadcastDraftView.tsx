"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { BroadcastComposeForm } from "@/dashboard/components/BroadcastComposeForm";
import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import {
  clearBroadcastDetailCache,
  useBroadcastDetail,
} from "@/dashboard/components/BroadcastDetailContext";
import { useDashboardPaths } from "@/dashboard/paths";
import { useEmailPaths } from "@/email/paths";
import { fetchEmailCachedOptional } from "@/email/components/email-cached-fetch";
import { readEmailStale } from "@/email/components/useEmailViewLoading";
import { EmailAlerts } from "@/email/components/EmailShared";
import type { Address, AudienceGroupSummary } from "@/email/components/types";

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
    if (
      preferred &&
      domainAddresses.some((a) => a.email.toLowerCase() === preferred)
    ) {
      return preferred;
    }
  }
  return domainAddresses[0]?.email ?? "";
}

export function BroadcastDraftView() {
  const productId = useProductId();
  const { apiBase } = useEmailPaths();
  const { broadcasts } = useDashboardPaths();
  const router = useRouter();
  const { broadcastId, detail, loading, refresh } = useBroadcastDetail();

  const [allGroups, setAllGroups] = useState<AudienceGroupSummary[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [from, setFrom] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

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
    setSelectedGroupIds(detail.broadcast.groupIds);
    setFrom(detail.broadcast.from ?? "");
    setSubject(detail.broadcast.subject ?? "");
    setBody(detail.broadcast.body ?? "");
    setHydrated(true);
  }, [detail, hydrated]);

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
      return domain !== "" && domains.has(domain);
    });
  }, [addresses, selectedGroups]);

  // Keep From on the audience domain(s); prefer group default sender.
  useEffect(() => {
    if (!hydrated || domainAddresses.length === 0) return;
    const allowed = new Set(
      domainAddresses.map((a) => a.email.toLowerCase()),
    );
    if (from && allowed.has(from.toLowerCase())) return;
    setFrom(pickDefaultFrom(selectedGroups, domainAddresses));
  }, [domainAddresses, from, hydrated, selectedGroups]);

  async function saveDraft(opts?: { quiet?: boolean }) {
    if (!opts?.quiet) setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `${apiBase}/broadcasts/${encodeURIComponent(broadcastId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            groupIds: selectedGroupIds,
            from: from || null,
            subject,
            text: body,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save draft");
      clearBroadcastDetailCache(productId, broadcastId);
      await refresh(true);
      if (!opts?.quiet) setDraftStatus("Draft saved");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save draft");
      return false;
    } finally {
      if (!opts?.quiet) setSaving(false);
    }
  }

  async function broadcastNow() {
    setBroadcasting(true);
    setError(null);
    setDraftStatus(null);
    try {
      const saved = await saveDraft({ quiet: true });
      if (!saved) return;
      const res = await fetch(
        `${apiBase}/broadcasts/${encodeURIComponent(broadcastId)}/send`,
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Broadcast failed");
      clearBroadcastDetailCache(productId, broadcastId);
      router.replace(`/broadcasts/${encodeURIComponent(broadcastId)}`);
      await refresh(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Broadcast failed");
    } finally {
      setBroadcasting(false);
    }
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
          onBroadcast={() => void broadcastNow()}
        />
      </div>
    </div>
  );
}
