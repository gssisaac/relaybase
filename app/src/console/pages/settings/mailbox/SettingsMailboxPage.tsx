"use client";

import { Inbox } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FieldCheck } from "@/components/ui/field-check";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ConnectionCard,
  SettingsPageBody,
} from "@/console/pages/settings/settings-shared";
import {
  desktopAwareFetch,
  readResponseJson,
} from "@/lib/desktop/api";

const MIN_RETAIN = 100;
const DRAFT_CAP_WHEN_LIMITING = 5000;

type SettingsResponse = {
  inboundRetainPerDomain?: number | null;
  error?: string;
};

function parseRetain(unlimited: boolean, raw: string): number | null | "invalid" {
  if (unlimited) return null;
  const trimmed = raw.trim();
  if (!trimmed) return "invalid";
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < MIN_RETAIN) return "invalid";
  return n;
}

function isLowering(
  saved: number | null,
  next: number | null,
): boolean {
  if (next == null) return false;
  if (saved == null) return true;
  return next < saved;
}

export function SettingsMailboxPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedRetain, setSavedRetain] = useState<number | null>(null);
  const [unlimited, setUnlimited] = useState(true);
  const [capInput, setCapInput] = useState(String(DRAFT_CAP_WHEN_LIMITING));
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await desktopAwareFetch("/api/email/settings");
      const data = await readResponseJson<SettingsResponse>(res);
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to load mailbox settings");
      }
      const retain =
        typeof data.inboundRetainPerDomain === "number"
          ? data.inboundRetainPerDomain
          : null;
      setSavedRetain(retain);
      setUnlimited(retain == null);
      setCapInput(String(retain ?? DRAFT_CAP_WHEN_LIMITING));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load mailbox settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const parsed = parseRetain(unlimited, capInput);
  const dirty =
    !loading &&
    parsed !== "invalid" &&
    (parsed ?? null) !== savedRetain;

  async function persist(next: number | null) {
    setSaving(true);
    setError(null);
    try {
      const res = await desktopAwareFetch("/api/email/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inboundRetainPerDomain: next }),
      });
      const data = await readResponseJson<SettingsResponse>(res);
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to save mailbox settings");
      }
      const retain =
        typeof data.inboundRetainPerDomain === "number"
          ? data.inboundRetainPerDomain
          : null;
      setSavedRetain(retain);
      setUnlimited(retain == null);
      setCapInput(String(retain ?? DRAFT_CAP_WHEN_LIMITING));
      toast.success("Mailbox settings saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save mailbox settings");
    } finally {
      setSaving(false);
      setConfirmOpen(false);
    }
  }

  function handleSaveClick() {
    if (parsed === "invalid") {
      setError(
        `Enter a whole number of at least ${MIN_RETAIN}, or keep all inbound mail.`,
      );
      return;
    }
    if (isLowering(savedRetain, parsed)) {
      setConfirmOpen(true);
      return;
    }
    void persist(parsed);
  }

  return (
    <SettingsPageBody>
      <ConnectionCard
        icon={Inbox}
        title="Inbound retention"
        description="How many inbound messages to keep per domain. The default is unlimited. Sent mail is not pruned."
      >
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-4">
            <FieldCheck
              id="keep-all-inbound"
              checked={unlimited}
              onCheckedChange={(checked) => {
                setUnlimited(checked);
                if (!checked && !capInput.trim()) {
                  setCapInput(String(DRAFT_CAP_WHEN_LIMITING));
                }
              }}
              label="Keep all inbound mail"
              description="When checked, the Worker never deletes inbound messages. Uncheck to keep only the newest N per domain."
            />
            {!unlimited ? (
              <div className="space-y-2">
                <Label htmlFor="inbound-retain-cap">
                  Keep newest inbound per domain
                </Label>
                <Input
                  id="inbound-retain-cap"
                  type="text"
                  inputMode="numeric"
                  value={capInput}
                  onChange={(e) => setCapInput(e.target.value)}
                  className="max-w-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Minimum {MIN_RETAIN}. Older inbound is removed on the next
                  Worker cleanup cycle (about every 15 minutes), not immediately.
                </p>
              </div>
            ) : null}
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
            <Button
              type="button"
              size="sm"
              disabled={saving || loading || !dirty}
              onClick={handleSaveClick}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        )}
      </ConnectionCard>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Lower inbound retention?</AlertDialogTitle>
            <AlertDialogDescription>
              Starting with the next cleanup cycle, inbound messages beyond the
              newest {parsed === "invalid" || parsed == null ? "cap" : parsed}{" "}
              per domain will be deleted from R2 and the mail index. This cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving || parsed === "invalid"}
              onClick={(e) => {
                e.preventDefault();
                if (parsed !== "invalid") void persist(parsed);
              }}
            >
              {saving ? "Saving…" : "Lower limit"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsPageBody>
  );
}
