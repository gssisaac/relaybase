"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { UserSummary } from "@/lib/admin/user-profile";
import { cn } from "@/lib/utils";

type UserNavSidebarProps = {
  currentUserId: string;
};

export function UserNavSidebar({ currentUserId }: UserNavSidebarProps) {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const activeRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/users", { cache: "no-store" });
        const data = (await res.json()) as { users?: UserSummary[]; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Failed to load users");
        setUsers(data.users ?? []);
      } catch {
        setUsers([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [currentUserId, users]);

  return (
    <aside className="flex h-full min-h-0 w-56 shrink-0 flex-col border-r border-border bg-muted/20">
      <div className="shrink-0 border-b border-border px-4 py-3">
        <Link
          href="/users"
          className="text-sm font-semibold tracking-tight text-foreground hover:underline"
        >
          Users
        </Link>
      </div>

      <nav
        className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2"
        aria-label="All users"
      >
        {loading ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">Loading…</p>
        ) : users.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">No users</p>
        ) : (
          users.map((user) => {
            const active = user.id === currentUserId;
            return (
              <Link
                key={user.id}
                ref={active ? activeRef : undefined}
                href={`/users/${encodeURIComponent(user.id)}`}
                className={cn(
                  "flex flex-col gap-0.5 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                <span className="truncate font-mono text-xs font-medium">{user.id}</span>
                {user.domain ? (
                  <span
                    className={cn(
                      "truncate font-mono text-[11px]",
                      active ? "text-accent-foreground/80" : "text-muted-foreground",
                    )}
                  >
                    {user.domain}
                  </span>
                ) : null}
              </Link>
            );
          })
        )}
      </nav>
    </aside>
  );
}
