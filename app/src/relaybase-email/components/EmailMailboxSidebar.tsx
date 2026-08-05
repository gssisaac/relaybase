"use client";

import type { LucideIcon } from "lucide-react";
import { AtSign, Inbox, Pencil, RefreshCw, Send } from "lucide-react";
import Link from "next/link";
import { memo, useEffect, useMemo, useRef } from "react";

import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CurrentDomainSelect } from "@/relaybase-email/components/CurrentDomainSelect";
import {
  useEmailMailbox,
} from "@/relaybase-email/components/EmailMailboxContext";
import type { EmailMailboxSection } from "@/relaybase-email/components/EmailMailboxLayout";
import { useEmailPaths } from "@/relaybase-email/components/useEmailPaths";
import type { Address } from "@/relaybase-email/components/types";
import { cn } from "@/lib/utils";

const SECTIONS: {
  id: EmailMailboxSection;
  label: string;
  icon: LucideIcon;
  hrefKey: "compose" | "inbox" | "sent";
}[] = [
  { id: "compose", label: "Compose", icon: Pencil, hrefKey: "compose" },
  { id: "inbox", label: "Inbox", icon: Inbox, hrefKey: "inbox" },
  { id: "sent", label: "Sent", icon: Send, hrefKey: "sent" },
];

function accountHref(
  base: string,
  section: EmailMailboxSection,
  email: string,
) {
  const params = new URLSearchParams();
  if (section === "compose") {
    params.set("from", email);
  } else {
    params.set("account", email);
  }
  return `${base}?${params.toString()}`;
}

function localPart(email: string) {
  const at = email.indexOf("@");
  return at > 0 ? email.slice(0, at) : email;
}

type EmailMailboxSidebarProps = {
  section: EmailMailboxSection;
  pathname: string;
  activeAccount: string | null;
};

function EmailMailboxSidebarInner({
  section,
  pathname,
  activeAccount,
}: EmailMailboxSidebarProps) {
  const { compose, inbox, sent } = useEmailPaths();
  const hrefs = useMemo(
    () => ({ compose, inbox, sent }),
    [compose, inbox, sent],
  );
  const {
    addresses,
    activity,
    sent: sentMessages,
    refreshing,
    refresh,
    openAccounts,
    setOpenAccounts,
  } = useEmailMailbox();

  // Keep last non-empty list so refresh/domain flickers don't unmount the accordion.
  const stableAddressesRef = useRef<Address[]>([]);
  if (addresses.length > 0) {
    stableAddressesRef.current = addresses;
  }
  const sidebarAddresses =
    addresses.length > 0 ? addresses : stableAddressesRef.current;

  const addressKey = sidebarAddresses.map((a) => a.email).join("\0");

  useEffect(() => {
    if (!activeAccount) return;
    setOpenAccounts((prev) =>
      prev.includes(activeAccount) ? prev : [...prev, activeAccount],
    );
  }, [activeAccount, setOpenAccounts]);

  useEffect(() => {
    if (!addressKey) return;
    const emails = addressKey.split("\0");
    setOpenAccounts((prev) => {
      const stillValid = prev.filter((email) => emails.includes(email));
      if (stillValid.length > 0) return stillValid;
      return activeAccount ? [activeAccount] : [emails[0]!];
    });
  }, [addressKey, activeAccount, setOpenAccounts]);

  const countsByAccount = useMemo(() => {
    const map = new Map<string, { inbox: number; sent: number }>();
    for (const address of sidebarAddresses) {
      const email = address.email.toLowerCase();
      map.set(address.email, {
        inbox: activity.filter((m) => m.toEmail.toLowerCase() === email).length,
        sent: sentMessages.filter((m) => m.from.toLowerCase() === email).length,
      });
    }
    return map;
  }, [sidebarAddresses, activity, sentMessages]);

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-muted/30">
      <div className="space-y-2 border-b border-border p-3">
        <CurrentDomainSelect className="h-9 w-full" />
      </div>

      <nav
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2"
        aria-label="Mail accounts"
      >
        {sidebarAddresses.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            No accounts yet. Add one under Accounts.
          </p>
        ) : (
          <Accordion
            multiple
            value={openAccounts}
            onValueChange={(value) => {
              setOpenAccounts(Array.isArray(value) ? value : []);
            }}
            className="space-y-0.5"
          >
            {sidebarAddresses.map((address) => {
              const counts = countsByAccount.get(address.email);
              const display =
                address.displayName?.trim() || localPart(address.email);

              return (
                <AccordionItem
                  key={address.email}
                  value={address.email}
                  className="border-none"
                >
                  <AccordionTrigger className="rounded-md px-2 py-1.5 text-sm font-medium hover:bg-accent hover:no-underline [&>svg]:size-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <AtSign
                        className="size-3.5 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      <span className="min-w-0 truncate" title={address.email}>
                        {display}
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pb-0 pl-4">
                    <div className="flex flex-col gap-0.5 py-1">
                      {SECTIONS.map((item) => {
                        const Icon = item.icon;
                        const href = accountHref(
                          hrefs[item.hrefKey],
                          item.id,
                          address.email,
                        );
                        const baseHref = hrefs[item.hrefKey];
                        const onThisAccount = activeAccount === address.email;
                        const pathActive =
                          pathname === baseHref ||
                          pathname.startsWith(`${baseHref}/`);
                        const active =
                          section === item.id && pathActive && onThisAccount;
                        const count =
                          item.id === "inbox"
                            ? counts?.inbox
                            : item.id === "sent"
                              ? counts?.sent
                              : undefined;

                        return (
                          <Link
                            key={item.id}
                            href={href}
                            className={cn(
                              "flex items-center gap-2 rounded px-2 py-1 text-xs transition-colors",
                              active
                                ? "bg-accent font-medium text-accent-foreground"
                                : "text-muted-foreground hover:bg-accent hover:text-foreground",
                            )}
                          >
                            <Icon className="size-3.5 shrink-0" aria-hidden />
                            <span className="min-w-0 flex-1 truncate text-left">
                              {item.label}
                            </span>
                            {count !== undefined && count > 0 ? (
                              <span className="text-[10px] tabular-nums text-muted-foreground">
                                {count}
                              </span>
                            ) : null}
                          </Link>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </nav>

      <div className="border-t border-border p-3">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => void refresh(true)}
          disabled={refreshing}
        >
          <RefreshCw
            className={refreshing ? "size-4 animate-spin" : "size-4"}
          />
          Refresh
        </Button>
      </div>
    </aside>
  );
}

export const EmailMailboxSidebar = memo(EmailMailboxSidebarInner);
