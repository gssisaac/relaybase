"use client";

import { Globe } from "lucide-react";
import Link from "next/link";

import { useDomain } from "@/lib/dashboard/DomainContext";
import { useEmailPaths } from "@/relaybase-email/components/useEmailPaths";
import { cn } from "@/lib/utils";

type DomainNavSidebarProps = {
  /** Called after a different domain is selected (e.g. leave account detail). */
  onDomainSelect?: (domain: string) => void;
};

export function DomainNavSidebar({ onDomainSelect }: DomainNavSidebarProps = {}) {
  const { domains, activeDomain, loading, setActiveDomain } = useDomain();
  const { domains: domainsHref } = useEmailPaths();
  const readyDomains = domains.filter(
    (entry) => entry.onboarding?.status === "ready",
  );

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-muted/30">
      <div className="border-b border-border px-3 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Domains
        </p>
      </div>

      <nav
        className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2"
        aria-label="Domains"
      >
        {loading && domains.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            Loading domains…
          </p>
        ) : readyDomains.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            No ready domains yet. Finish onboarding on{" "}
            <Link
              href={domainsHref}
              className="underline underline-offset-2 hover:text-foreground"
            >
              Domains
            </Link>
            .
          </p>
        ) : (
          readyDomains.map((entry) => {
            const active = activeDomain === entry.domain;
            return (
              <button
                key={entry.domain}
                type="button"
                onClick={() => {
                  if (active) return;
                  void setActiveDomain(entry.domain).then(() => {
                    onDomainSelect?.(entry.domain);
                  });
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                  active
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Globe
                  className="size-3.5 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate" title={entry.domain}>
                  {entry.domain}
                </span>
                {entry.addressCount > 0 ? (
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {entry.addressCount}
                  </span>
                ) : null}
              </button>
            );
          })
        )}
      </nav>

      <div className="border-t border-border p-3">
        <Link
          href={domainsHref}
          className="block text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Manage domains
        </Link>
      </div>
    </aside>
  );
}
