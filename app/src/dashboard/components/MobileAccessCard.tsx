"use client";

import { Check, Copy, Eye, EyeOff, RefreshCw, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Switch } from "@/components/ui/switch";
import {
  disableMobileConfig,
  fetchMobileConfigStatus,
  setMobileConfigPassword,
  type MobileConfigStatus,
} from "@/lib/desktop/mobile-config";

function maskPassword(value: string): string {
  if (!value) return "—";
  if (value.length <= 10) return "••••••••••";
  return `${value.slice(0, 4)}${"•".repeat(12)}${value.slice(-4)}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

/**
 * Settings card for the global mobile access password. The desktop writes a
 * salted hash to Worker KV via /console/mobile-config; the plain password is
 * shown once after generation and never persisted on disk.
 */
export function MobileAccessCard() {
  const [status, setStatus] = useState<MobileConfigStatus | null>(null);
  const [plainPassword, setPlainPassword] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchMobileConfigStatus()
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);

  const enabled = status?.enabled ?? false;

  async function handleEnable() {
    setBusy(true);
    setError(null);
    try {
      const result = await setMobileConfigPassword();
      setStatus({ enabled: true, updatedAt: result.updatedAt });
      setPlainPassword(result.password);
      setRevealed(true);
      toast.success("Mobile access enabled");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to enable");
    } finally {
      setBusy(false);
    }
  }

  async function handleRegenerate() {
    setBusy(true);
    setError(null);
    try {
      const result = await setMobileConfigPassword();
      setStatus({ enabled: true, updatedAt: result.updatedAt });
      setPlainPassword(result.password);
      setRevealed(true);
      toast.success("Mobile password regenerated — old sessions are invalidated");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to regenerate");
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    setBusy(true);
    setError(null);
    try {
      const s = await disableMobileConfig();
      setStatus(s);
      setPlainPassword(null);
      setRevealed(false);
      toast.success("Mobile access disabled");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to disable");
    } finally {
      setBusy(false);
    }
  }

  async function copyPassword() {
    if (!plainPassword) return;
    try {
      await navigator.clipboard.writeText(plainPassword);
      setCopied(true);
    } catch {
      toast.error("Copy failed — select and copy manually");
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Smartphone
            className="size-3.5 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <CardTitle className="text-sm">Mobile access</CardTitle>
        </div>
        <CardDescription>
          Configure a password the Relaybase mobile app uses to connect
          directly to this Worker. Stored only in Worker KV — never on this Mac.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load mobile config</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <Label className="text-sm font-medium">Mobile access</Label>
            <p className="text-xs text-muted-foreground">
              {loading
                ? "Checking Worker…"
                : enabled
                  ? `Enabled — last set ${formatDate(status?.updatedAt ?? null)}.`
                  : "Disabled — the mobile app cannot connect until enabled."}
            </p>
          </div>
          <Switch
            checked={enabled}
            disabled={loading || busy}
            onCheckedChange={(next) => {
              if (next) void handleEnable();
              else void handleDisable();
            }}
          />
        </div>

        {enabled ? (
          <div className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="mobile-password-input">Mobile password</Label>
              <span className="font-mono text-[11px] text-muted-foreground">
                {plainPassword && revealed
                  ? "shown once"
                  : maskPassword(plainPassword ?? "")}
              </span>
            </div>
            <div className="flex gap-2">
              <Input
                id="mobile-password-input"
                type={revealed ? "text" : "password"}
                value={plainPassword ?? ""}
                readOnly
                placeholder="••••••••••••"
                className="font-mono text-xs"
                autoComplete="off"
                spellCheck={false}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!plainPassword}
                onClick={() => setRevealed((v) => !v)}
                aria-label={revealed ? "Hide password" : "Reveal password"}
              >
                {revealed ? (
                  <EyeOff className="size-3.5" />
                ) : (
                  <Eye className="size-3.5" />
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!plainPassword}
                onClick={() => void copyPassword()}
              >
                {copied ? (
                  <Check className="size-3.5" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              The plain password is shown only right after it is generated or
              regenerated. If you lose it, regenerate to issue a new one — old
              mobile sessions stop working immediately.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void handleRegenerate()}
            >
              <RefreshCw className="size-3.5" />
              Regenerate password
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
