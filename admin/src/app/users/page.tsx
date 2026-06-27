"use client";

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

type UserRow = {
  id: string;
  createdAt: string;
  lastSeenAt: string;
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/users", { cache: "no-store" });
        const data = (await res.json()) as { users?: UserRow[]; error?: string };
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
    <div className="mx-auto w-full max-w-4xl space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            Accounts created via the user dashboard (dev auth — id only).
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
                  <TableHead>ID</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last seen</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-mono text-sm">{user.id}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(user.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(user.lastSeenAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">Active</Badge>
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
