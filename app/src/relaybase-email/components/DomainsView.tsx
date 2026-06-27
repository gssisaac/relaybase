"use client";

import { Check, Globe, Plus, Star, Trash2 } from "lucide-react";
import { useState } from "react";

import { useDomain } from "@/lib/dashboard/DomainContext";
import { EmailAlerts } from "@/relaybase-email/components/EmailShared";
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

export function DomainsView() {
  const {
    domains,
    activeDomain,
    loading,
    error,
    refresh,
    setActiveDomain,
    addDomain,
    removeDomain,
  } = useDomain();
  const [domainInput, setDomainInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [workingDomain, setWorkingDomain] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setLocalError(null);
    setMessage(null);
    try {
      const result = await addDomain(domainInput);
      setDomainInput("");
      setMessage(result.message);
      if (result.r2Error) {
        setLocalError(result.r2Error);
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to add domain");
    } finally {
      setSaving(false);
    }
  }

  async function handleSetActive(domain: string) {
    setWorkingDomain(domain);
    setLocalError(null);
    setMessage(null);
    try {
      await setActiveDomain(domain);
      setMessage(`${domain} is now your active domain`);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to update domain");
    } finally {
      setWorkingDomain(null);
    }
  }

  async function handleRemove(domain: string) {
    if (
      !window.confirm(
        `Remove ${domain}? Addresses, audience, broadcasts, and sent mail for this domain will be deleted.`,
      )
    ) {
      return;
    }
    setWorkingDomain(domain);
    setLocalError(null);
    setMessage(null);
    try {
      await removeDomain(domain);
      setMessage(`Removed ${domain}`);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to remove domain");
    } finally {
      setWorkingDomain(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Domains</h1>
        <p className="text-sm text-muted-foreground">
          Manage sending domains. Accounts, email, broadcasts, and audience are
          scoped to the active domain you choose in each section.
        </p>
      </div>

      <EmailAlerts error={error ?? localError} message={message} />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Add domain</CardTitle>
          <CardDescription>
            Register a domain you send from and receive mail on. Relaybase will
          create the shared inbound R2 bucket if it does not exist yet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1 space-y-1.5">
              <Label htmlFor="new-domain">Domain</Label>
              <Input
                id="new-domain"
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                placeholder="example.com"
                disabled={saving}
              />
            </div>
            <Button type="submit" size="sm" disabled={saving || !domainInput.trim()}>
              <Plus className="mr-1.5 size-3.5" />
              {saving ? "Adding…" : "Add domain"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm">Your domains</CardTitle>
            <CardDescription>
              {activeDomain ? (
                <>
                  Active: <span className="font-mono">{activeDomain}</span>
                </>
              ) : (
                "No active domain selected"
              )}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {domains.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead>Senders</TableHead>
                  <TableHead>Audience</TableHead>
                  <TableHead>Broadcasts</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Inbound R2</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {domains.map((entry) => (
                  <TableRow key={entry.domain}>
                    <TableCell className="font-mono text-sm">
                      <div className="flex items-center gap-2">
                        <Globe className="size-3.5 text-muted-foreground" />
                        {entry.domain}
                        {entry.active ? (
                          <Badge variant="default" className="text-[10px]">
                            Active
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>{entry.addressCount}</TableCell>
                    <TableCell>{entry.audienceCount}</TableCell>
                    <TableCell>{entry.broadcastCount}</TableCell>
                    <TableCell>{entry.sentCount}</TableCell>
                    <TableCell>
                      {entry.r2Provisioned ? (
                        <div className="space-y-1">
                          <Badge
                            variant={entry.r2WorkerReady ? "default" : "secondary"}
                            className="text-[10px]"
                          >
                            {entry.r2WorkerReady ? "R2 ready" : "R2 provisioned"}
                          </Badge>
                          {entry.r2BucketName ? (
                            <p className="font-mono text-[10px] text-muted-foreground">
                              {entry.r2BucketName}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not provisioned</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {!entry.active ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={workingDomain === entry.domain}
                            onClick={() => void handleSetActive(entry.domain)}
                          >
                            <Star className="mr-1 size-3.5" />
                            Set active
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" disabled>
                            <Check className="mr-1 size-3.5" />
                            Active
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={workingDomain === entry.domain}
                          onClick={() => void handleRemove(entry.domain)}
                        >
                          <Trash2 className="mr-1 size-3.5" />
                          Remove
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">
              No domains yet. Add one above to get started.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
