"use client";

import { Check, Copy, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { RELAYBASE_API } from "@/relaybase/components/constants";
import { EmailSenderAlerts } from "@/relaybase/components/EmailSenderShared";
import type { RelaybaseDashboardAuthTokenRow } from "@/relaybase/components/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CredentialInput } from "@/components/ui/credential-input";
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

type UserAuthTokensSectionProps = {
  userId: string;
  tokens: RelaybaseDashboardAuthTokenRow[];
  onChange: () => void;
};

export function UserAuthTokensSection({
  userId,
  tokens,
  onChange,
}: UserAuthTokensSectionProps) {
  const [tokenLabel, setTokenLabel] = useState("");
  const [issuingToken, setIssuingToken] = useState(false);
  const [revokingTokenId, setRevokingTokenId] = useState<string | null>(null);
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [tokenMessage, setTokenMessage] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    setTokenError(null);
    setTokenMessage(null);
  }, [tokens.length]);

  async function issueToken() {
    setIssuingToken(true);
    setTokenError(null);
    setTokenMessage(null);
    setIssuedToken(null);
    try {
      const res = await fetch(`${RELAYBASE_API}/auth-tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: tokenLabel.trim() || `${userId} dashboard`,
          productId: userId,
        }),
      });
      const data = (await res.json()) as {
        token?: string;
        error?: string;
        message?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Issue failed");
      setIssuedToken(data.token ?? null);
      setTokenLabel("");
      setTokenMessage(data.message ?? "Auth token issued");
      onChange();
    } catch (e) {
      setTokenError(e instanceof Error ? e.message : "Issue failed");
    } finally {
      setIssuingToken(false);
    }
  }

  async function revokeToken(id: string) {
    if (
      !window.confirm(
        "Revoke this auth token? This user will lose dashboard API access.",
      )
    ) {
      return;
    }
    setRevokingTokenId(id);
    setTokenError(null);
    setTokenMessage(null);
    try {
      const res = await fetch(`${RELAYBASE_API}/auth-tokens/${id}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Revoke failed");
      setTokenMessage("Auth token revoked");
      onChange();
    } catch (e) {
      setTokenError(e instanceof Error ? e.message : "Revoke failed");
    } finally {
      setRevokingTokenId(null);
    }
  }

  const copyText = useCallback(async (value: string, field: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedField(field);
    window.setTimeout(() => setCopiedField(null), 2000);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Auth tokens</CardTitle>
        <CardDescription>
          <code className="text-xs">rb-auth-…</code> tokens scoped to this user
          (product ID <span className="font-mono">{userId}</span>).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <EmailSenderAlerts error={tokenError} message={tokenMessage} />

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1 space-y-1.5">
            <Label htmlFor={`auth-token-label-${userId}`}>Label (optional)</Label>
            <Input
              id={`auth-token-label-${userId}`}
              value={tokenLabel}
              onChange={(e) => setTokenLabel(e.target.value)}
              placeholder={`${userId} dashboard`}
              disabled={issuingToken}
            />
          </div>
          <Button size="sm" onClick={() => void issueToken()} disabled={issuingToken}>
            {issuingToken ? "Issuing…" : "Issue token"}
          </Button>
        </div>

        {issuedToken ? (
          <Alert>
            <AlertTitle>Copy this token now</AlertTitle>
            <AlertDescription className="space-y-2">
              <CredentialInput
                readOnly
                value={issuedToken}
                className="font-mono text-xs"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => void copyText(issuedToken, "issued-auth-token")}
              >
                {copiedField === "issued-auth-token" ? (
                  <>
                    <Check className="mr-1.5 size-3.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-1.5 size-3.5" />
                    Copy token
                  </>
                )}
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {tokens.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokens.map((token) => (
                <TableRow key={token.id}>
                  <TableCell>{token.label ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">
                    rb-auth-{token.tokenPrefix}…
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(token.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={revokingTokenId === token.id}
                      onClick={() => void revokeToken(token.id)}
                    >
                      <Trash2 className="mr-1 size-3.5" />
                      {revokingTokenId === token.id ? "Revoking…" : "Revoke"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">No auth tokens for this user.</p>
        )}
      </CardContent>
    </Card>
  );
}
