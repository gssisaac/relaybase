"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useState } from "react";

import { RELAYBASE_API } from "@/relaybase/components/constants";
import { EmailSenderAlerts } from "@/relaybase/components/EmailSenderShared";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type BrandingDetail = {
  domain: string;
  zoneId: string | null;
  dnsConfigured: boolean;
  dnsCanApply: boolean;
  dnsApplyHint: string | null;
  dmarcEnforced: boolean;
  notes: string[];
  dmarc: { name: string; expected: string; found: boolean };
};

type UserBrandingSectionProps = {
  domain: string | null;
  branding: BrandingDetail | null;
  onRefresh: () => void;
};

export function UserBrandingSection({
  domain,
  branding,
  onRefresh,
}: UserBrandingSectionProps) {
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const applyDns = useCallback(async () => {
    if (!domain) return;
    setApplying(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${RELAYBASE_API}/branding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "DNS apply failed");
      setMessage("DMARC DNS updated");
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "DNS apply failed");
    } finally {
      setApplying(false);
    }
  }, [domain, onRefresh]);

  if (!domain) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">DMARC</CardTitle>
          <CardDescription>
            No email domain configured for this user yet.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-sm">DMARC</CardTitle>
          <CardDescription>
            Sender authentication status for{" "}
            <span className="font-mono">{domain}</span>
          </CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={onRefresh} disabled={applying}>
          <RefreshCw className={cn("size-4", applying && "animate-spin")} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <EmailSenderAlerts error={error} message={message} />

        {branding ? (
          <>
            <div className="flex flex-wrap gap-2">
              <Badge variant={branding.dmarcEnforced ? "default" : "secondary"}>
                DMARC {branding.dmarcEnforced ? "enforced" : "not enforced"}
              </Badge>
              <Badge variant={branding.dnsConfigured ? "default" : "secondary"}>
                DNS {branding.dnsConfigured ? "configured" : "pending"}
              </Badge>
            </div>

            {branding.dnsCanApply === false && branding.dnsApplyHint ? (
              <p className="text-xs text-muted-foreground">{branding.dnsApplyHint}</p>
            ) : null}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Record</TableHead>
                  <TableHead>Expected</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow key={branding.dmarc.name}>
                  <TableCell className="font-mono text-xs">{branding.dmarc.name}</TableCell>
                  <TableCell className="max-w-[240px] truncate text-xs text-muted-foreground">
                    {branding.dmarc.expected}
                  </TableCell>
                  <TableCell>
                    {branding.dmarc.found ? (
                      <Badge variant="default">OK</Badge>
                    ) : (
                      <Badge variant="secondary">Missing</Badge>
                    )}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>

            {branding.notes.length ? (
              <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                {branding.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={applying || branding.dnsCanApply === false}
                onClick={() => void applyDns()}
              >
                Apply DMARC
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            DMARC status unavailable — check Cloudflare credentials in Settings.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
