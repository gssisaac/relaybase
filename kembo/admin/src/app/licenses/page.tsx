"use client";

import { Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

type LicenseRecord = {
  id: string;
  email: string;
  keyPrefix: string;
  createdAt: string;
  active: boolean;
  stripeSessionId: string | null;
  note: string | null;
};

export default function LicensesPage() {
  const [licenses, setLicenses] = useState<LicenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [issuedKey, setIssuedKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/licenses", { cache: "no-store" });
      const data = (await res.json()) as {
        licenses?: LicenseRecord[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to load licenses");
      setLicenses(data.licenses ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleIssue() {
    setSaving(true);
    setError(null);
    setIssuedKey(null);
    try {
      const res = await fetch("/api/licenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, note: "manual-admin" }),
      });
      const data = (await res.json()) as {
        licenseKey?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Issue failed");
      setIssuedKey(data.licenseKey ?? null);
      setEmail("");
      setAddOpen(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Issue failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm("Revoke this license?")) return;
    const res = await fetch(`/api/licenses?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Revoke failed");
      return;
    }
    await refresh();
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto p-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Licenses</CardTitle>
            <CardDescription>
              One-time ($39) Mac app license keys — issued via Stripe webhook or
              manually.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Dialog
              open={addOpen}
              onOpenChange={(open) => {
                setAddOpen(open);
                if (!open) setIssuedKey(null);
              }}
            >
              <DialogTrigger render={<Button size="sm" />}>
                <Plus className="size-3.5" />
                Issue license
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Issue license</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="lic-email">Buyer email</Label>
                    <Input
                      id="lic-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="buyer@example.com"
                    />
                  </div>
                  <Button
                    className="w-full"
                    disabled={!email.trim() || saving}
                    onClick={() => void handleIssue()}
                  >
                    Issue
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void refresh()}
              disabled={loading}
            >
              <RefreshCw className="size-3.5" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {issuedKey ? (
            <div className="mb-4 rounded-md border border-border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">
                Copy now — shown once
              </p>
              <p className="mt-1 break-all font-mono text-xs">{issuedKey}</p>
            </div>
          ) : null}
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : licenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No licenses yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Prefix</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {licenses.map((lic) => (
                  <TableRow key={lic.id}>
                    <TableCell className="text-sm">{lic.email}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {lic.keyPrefix}…
                    </TableCell>
                    <TableCell>
                      <Badge variant={lic.active ? "default" : "secondary"}>
                        {lic.active ? "Active" : "Revoked"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(lic.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {lic.note ?? "—"}
                    </TableCell>
                    <TableCell>
                      {lic.active ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void handleRevoke(lic.id)}
                        >
                          Revoke
                        </Button>
                      ) : null}
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
