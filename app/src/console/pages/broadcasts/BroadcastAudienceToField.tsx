"use client";

import { Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { audienceContactDisplayName } from "@/lib/audience-display";
import { useEmailPaths } from "@/email/lib/paths";
import type {
  AudienceGroupContact,
  AudienceGroupSummary,
} from "@/email/components/mailbox/types";
import {
  desktopAwareFetch,
  friendlyDesktopFetchError,
  readResponseJson,
} from "@/lib/desktop/api-base";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const PAGE_SIZE = 20;

type ListedContact = AudienceGroupContact & { groupName: string };

/**
 * Compose "To" row: audience group badges on one line with contact count on
 * the right; click opens a sheet to browse recipients (20 + load more).
 */
export function BroadcastAudienceToField({
  groups,
  selectedGroupIds,
  disabled,
}: {
  groups: AudienceGroupSummary[];
  selectedGroupIds: string[];
  disabled?: boolean;
}) {
  const { apiBase } = useEmailPaths();
  const [open, setOpen] = useState(false);
  const [contacts, setContacts] = useState<ListedContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const selectedGroups = useMemo(
    () => groups.filter((g) => selectedGroupIds.includes(g.id)),
    [groups, selectedGroupIds],
  );

  const recipientCount = selectedGroups.reduce(
    (sum, g) => sum + g.contactCount,
    0,
  );

  const loadContacts = useCallback(async () => {
    if (selectedGroups.length === 0) {
      setContacts([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all(
        selectedGroups.map(async (group) => {
          const res = await desktopAwareFetch(
            `${apiBase}/audience-groups/${encodeURIComponent(group.id)}/contacts`,
          );
          const data = await readResponseJson<{
            contacts?: AudienceGroupContact[];
            error?: string;
          }>(res);
          if (!res.ok) {
            throw new Error(data.error ?? `Failed to load ${group.name}`);
          }
          const list = (data.contacts ?? []) as AudienceGroupContact[];
          return list.map((c) => ({ ...c, groupName: group.name }));
        }),
      );
      // De-dupe by email (same as broadcast send).
      const seen = new Set<string>();
      const merged: ListedContact[] = [];
      for (const row of results.flat()) {
        const key = row.email.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(row);
      }
      merged.sort((a, b) => a.email.localeCompare(b.email));
      setContacts(merged);
    } catch (e) {
      setError(friendlyDesktopFetchError(e, "Failed to load contacts"));
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, [apiBase, selectedGroups]);

  useEffect(() => {
    if (!open) return;
    setVisibleCount(PAGE_SIZE);
    void loadContacts();
  }, [open, loadContacts]);

  const visible = contacts.slice(0, visibleCount);
  const hasMore = visibleCount < contacts.length;

  return (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-2 py-1">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {selectedGroups.length > 0 ? (
            selectedGroups.map((group) => (
              <button
                key={group.id}
                type="button"
                disabled={disabled}
                onClick={() => setOpen(true)}
                className="max-w-full rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
              >
                <Badge
                  variant="secondary"
                  className="inline-flex max-w-full cursor-pointer items-center gap-1 truncate text-[11px] font-normal hover:bg-secondary/80"
                >
                  <Users className="size-3 shrink-0 opacity-70" aria-hidden />
                  <span className="min-w-0 truncate">{group.name}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {group.contactCount.toLocaleString()}
                  </span>
                </Badge>
              </button>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">
              No audience selected
            </span>
          )}
        </div>
        {selectedGroups.length > 0 ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setOpen(true)}
            className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground tabular-nums hover:text-foreground disabled:opacity-50"
          >
            <Users className="size-3 opacity-70" aria-hidden />
            {recipientCount.toLocaleString()}
          </button>
        ) : null}
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="h-full gap-0 overflow-hidden p-0"
        >
          <SheetHeader className="shrink-0 border-b border-border/60">
            <SheetTitle>Audience</SheetTitle>
            <SheetDescription>
              {selectedGroups.map((g) => g.name).join(", ") || "—"}
              {contacts.length > 0
                ? ` · ${contacts.length.toLocaleString()} unique recipient${contacts.length === 1 ? "" : "s"}`
                : recipientCount > 0
                  ? ` · ~${recipientCount.toLocaleString()} contacts`
                  : ""}
            </SheetDescription>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {error ? (
              <p className="px-4 py-3 text-xs text-destructive">{error}</p>
            ) : null}
            {loading && contacts.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">
                Loading…
              </p>
            ) : contacts.length === 0 && !loading ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">
                No contacts in the selected groups.
              </p>
            ) : (
              <ul className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
                {visible.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-col gap-0.5 rounded-md px-2 py-2 text-sm hover:bg-muted/40"
                  >
                    <span className="truncate font-medium text-foreground">
                      {audienceContactDisplayName(c.email, c.name)}
                    </span>
                    <span className="truncate font-mono text-xs text-muted-foreground">
                      {c.email}
                    </span>
                    {selectedGroups.length > 1 ? (
                      <span className="truncate text-[11px] text-muted-foreground/80">
                        {c.groupName}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            {hasMore ? (
              <div className="border-t border-border/60 p-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() =>
                    setVisibleCount((n) =>
                      Math.min(n + PAGE_SIZE, contacts.length),
                    )
                  }
                >
                  Load more ({contacts.length - visibleCount} remaining)
                </Button>
              </div>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
