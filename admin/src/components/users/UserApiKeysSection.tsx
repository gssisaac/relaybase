"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";

import { EMAIL_SENDER_API } from "@/relaybase/components/constants";
import { EmailSenderAlerts } from "@/relaybase/components/EmailSenderShared";
import type { UserApiKeySummary } from "@/lib/admin/user-profile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type UserApiKeysSectionProps = {
  userId: string;
  domain: string | null;
  keys: UserApiKeySummary[];
  workerConnected: boolean;
  onChange: () => void;
};

export function UserApiKeysSection({
  userId,
  domain,
  keys,
  workerConnected,
  onChange,
}: UserApiKeysSectionProps) {
  const [keyDomain, setKeyDomain] = useState(domain ?? "");
  const [keyLabel, setKeyLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function createKey() {
    setCreating(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${EMAIL_SENDER_API}/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: keyDomain.trim(),
          label: keyLabel.trim() || userId,
        }),
      });
      const data = (await res.json()) as { domain?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Create failed");
      setMessage(`Issued API key for ${data.domain}`);
      setKeyLabel("");
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  async function deleteKey(key: UserApiKeySummary) {
    const name = key.label || key.domain;
    if (
      !window.confirm(
        `Delete API key "${name}"? Apps using this key will stop sending.`,
      )
    ) {
      return;
    }
    setDeletingId(key.id);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${EMAIL_SENDER_API}/keys/${key.id}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      setMessage(`Deleted key for ${key.domain}`);
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">API keys</CardTitle>
        <CardDescription>
          Domain-scoped send keys linked to this user&apos;s domain or label.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <EmailSenderAlerts error={error} message={message} />

        {!workerConnected ? (
          <p className="text-sm text-muted-foreground">
            Connect the worker in Settings before issuing API keys.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`user-key-domain-${userId}`}>Domain</Label>
              <Input
                id={`user-key-domain-${userId}`}
                value={keyDomain}
                onChange={(e) => setKeyDomain(e.target.value)}
                placeholder="yourdomain.com"
                disabled={creating}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`user-key-label-${userId}`}>Label (optional)</Label>
              <Input
                id={`user-key-label-${userId}`}
                value={keyLabel}
                onChange={(e) => setKeyLabel(e.target.value)}
                placeholder={userId}
                disabled={creating}
              />
            </div>
            <div className="sm:col-span-2">
              <Button
                size="sm"
                onClick={() => void createKey()}
                disabled={creating || !keyDomain.trim()}
              >
                {creating ? "Issuing…" : "Issue API key"}
              </Button>
            </div>
          </div>
        )}

        {keys.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-mono text-xs">{key.domain}</TableCell>
                  <TableCell>{key.label ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{key.keyPrefix}…</TableCell>
                  <TableCell>
                    <Badge variant={key.active ? "default" : "secondary"}>
                      {key.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={deletingId === key.id}
                      onClick={() => void deleteKey(key)}
                    >
                      <Trash2 className="mr-1 size-3.5" />
                      {deletingId === key.id ? "Deleting…" : "Delete"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">No API keys for this user.</p>
        )}
      </CardContent>
    </Card>
  );
}
