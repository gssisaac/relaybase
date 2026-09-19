"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { FieldCheck } from "@/components/ui/field-check";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CloudflareModuleIcon } from "@/console/components/CloudflareModuleIcon";
import { desktopRollbackInstall } from "@/lib/desktop/bridge";

type RollbackModuleKey = "worker" | "d1" | "r2";

export function RollbackModulesDialog({
  open,
  onOpenChange,
  cfAccountId,
  onRollbackSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cfAccountId: string;
  onRollbackSuccess: () => void;
}) {
  const [selected, setSelected] = useState<Record<RollbackModuleKey, boolean>>({
    worker: false,
    d1: false,
    r2: false,
  });
  const [wipePhrase, setWipePhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCount = Object.values(selected).filter(Boolean).length;
  const hasDataBearingSelected = selected.d1 || selected.r2;
  const phraseMatches = wipePhrase.trim().toUpperCase() === "DELETE ME";
  const canConfirm =
    selectedCount > 0 && (!hasDataBearingSelected || phraseMatches) && !busy;

  function toggleModule(key: RollbackModuleKey, value: boolean) {
    setSelected((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }

  async function handleConfirm() {
    if (!canConfirm) return;
    setBusy(true);
    setError(null);
    try {
      const modulesToRollback: RollbackModuleKey[] = (
        ["worker", "d1", "r2"] as RollbackModuleKey[]
      ).filter((k) => selected[k]);

      await desktopRollbackInstall(
        cfAccountId,
        hasDataBearingSelected ? "DELETE ME" : null,
        modulesToRollback,
      );
      onOpenChange(false);
      onRollbackSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rollback failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-destructive" />
            Rollback Cloudflare Resources
          </AlertDialogTitle>
          <AlertDialogDescription>
            Select the specific modules to delete from your Cloudflare account.
            Unchecked modules will remain untouched.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 py-2">
          {/* Module: Worker */}
          <div className="rounded-lg border p-3">
            <div className="flex items-start gap-2.5">
              <CloudflareModuleIcon kind="Worker" className="mt-0.5 size-5 shrink-0" />
              <div className="flex-1">
                <FieldCheck
                  id="rollback-worker"
                  checked={selected.worker}
                  onCheckedChange={(checked) => toggleModule("worker", checked)}
                  label="Email Worker Script (relaybase-api)"
                  description="Deletes the Cloudflare Worker script, routes, and cron schedule."
                />
              </div>
            </div>
          </div>

          {/* Module: D1 */}
          <div className="rounded-lg border p-3">
            <div className="flex items-start gap-2.5">
              <CloudflareModuleIcon kind="D1" className="mt-0.5 size-5 shrink-0" />
              <div className="flex-1">
                <FieldCheck
                  id="rollback-d1"
                  checked={selected.d1}
                  onCheckedChange={(checked) => toggleModule("d1", checked)}
                  label="D1 Databases (relaybase-db, mail, logs)"
                  description="Deletes all database tables, aliases, domain configurations, and credentials."
                />
                {selected.d1 ? (
                  <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-400">
                    ⚠️ Caution: All database records and routing rules will be permanently erased.
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {/* Module: R2 */}
          <div className="rounded-lg border p-3">
            <div className="flex items-start gap-2.5">
              <CloudflareModuleIcon kind="R2" className="mt-0.5 size-5 shrink-0" />
              <div className="flex-1">
                <FieldCheck
                  id="rollback-r2"
                  checked={selected.r2}
                  onCheckedChange={(checked) => toggleModule("r2", checked)}
                  label="R2 Mailbox Storage (relaybase-mailbox)"
                  description="Empties and deletes the R2 bucket for email attachments and raw emails."
                />
                {selected.r2 ? (
                  <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-400">
                    ⚠️ Caution: All email bodies and raw attachments stored in R2 will be permanently lost.
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {/* Confirmation phrase for data-bearing resources */}
          {hasDataBearingSelected ? (
            <div className="space-y-1.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <Label htmlFor="wipe-phrase" className="text-xs font-medium text-destructive">
                Type DELETE ME to confirm deleting data-bearing resources:
              </Label>
              <Input
                id="wipe-phrase"
                placeholder="DELETE ME"
                value={wipePhrase}
                onChange={(e) => setWipePhrase(e.target.value)}
                autoComplete="off"
                className="font-mono text-xs uppercase"
              />
            </div>
          ) : null}

          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={!canConfirm}
            onClick={() => void handleConfirm()}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Rollback selected ({selectedCount})
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
