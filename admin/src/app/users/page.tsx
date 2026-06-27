"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { UserSummary } from "@/lib/admin/user-profile";

function BrandingBadge({
  branding,
}: {
  branding: UserSummary["branding"];
}) {
  if (!branding) {
    return <Badge variant="secondary">No domain</Badge>;
  }
  if (branding.dmarcEnforced && branding.bimiReady) {
    return <Badge variant="default">Ready</Badge>;
  }
  if (branding.dnsConfigured) {
    return <Badge variant="secondary">Partial</Badge>;
  }
  return <Badge variant="secondary">Pending</Badge>;
}

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/users", { cache: "no-store" });
        const data = (await res.json()) as { users?: UserSummary[]; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Failed to load users");
        setUsers(data.users ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load users");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            Platform accounts — click a row for detail, stats, and management.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading users…</p>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead>Auth</TableHead>
                  <TableHead>API keys</TableHead>
                  <TableHead>7d activity</TableHead>
                  <TableHead>Branding</TableHead>
                  <TableHead>Last seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow
                    key={user.id}
                    className="cursor-pointer"
                    onClick={() =>
                      router.push(`/users/${encodeURIComponent(user.id)}`)
                    }
                  >
                    <TableCell>
                      <Link
                        href={`/users/${encodeURIComponent(user.id)}`}
                        className="font-mono text-sm font-medium hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {user.id}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {user.domain ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{user.authTokenCount}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{user.apiKeyCount}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <span className="tabular-nums">{user.requests7d}</span> req
                      {user.errors7d > 0 ? (
                        <span className="ml-2 text-destructive tabular-nums">
                          {user.errors7d} err
                        </span>
                      ) : null}
                      <span className="ml-2 tabular-nums">{user.emails7d} sent</span>
                    </TableCell>
                    <TableCell>
                      <BrandingBadge branding={user.branding} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(user.lastSeenAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
