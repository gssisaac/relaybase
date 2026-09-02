"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CloudflareModuleIcon } from "@/console/components/CloudflareModuleIcon";
import type { InstallResourceProbe } from "@/lib/desktop/bridge";

export const WIPE_PHRASE_DELETE_ME = "DELETE ME";
export const WIPE_PROJECT_NAME = "relaybase-api";

export function resourceIsOccupied(r: InstallResourceProbe): boolean {
  return Boolean(r.occupied);
}

export function wipePhraseIsValid(
  input: string,
  acceptedNames: string[],
): boolean {
  const t = input.trim();
  return (
    t === WIPE_PHRASE_DELETE_ME ||
    t === WIPE_PROJECT_NAME ||
    acceptedNames.includes(t)
  );
}

export function occupancySummary(r: InstallResourceProbe): string | null {
  if (r.kind === "r2") {
    if (r.occupied && (r.objectCount == null || Number.isNaN(r.objectCount))) {
      return "data present (count unavailable)";
    }
    const n = r.objectCount ?? 0;
    const plus = r.truncated ? "+" : "";
    return `${n.toLocaleString()}${plus} object${n === 1 && !r.truncated ? "" : "s"}`;
  }
  if (r.kind === "d1") {
    if (r.occupied && (r.rowCount == null || Number.isNaN(r.rowCount))) {
      return "data present (count unavailable)";
    }
    const n = r.rowCount ?? 0;
    const plus = r.truncated ? "+" : "";
    return `${n.toLocaleString()}${plus} row${n === 1 && !r.truncated ? "" : "s"}`;
  }
  return null;
}

function kindLabel(kind: string): "Worker" | "R2" | "D1" {
  if (kind === "r2") return "R2";
  if (kind === "d1") return "D1";
  return "Worker";
}

export function InstallWipeConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  targets,
  confirmLabel,
  onConfirm,
  confirming = false,
  checking = false,
  checkingMessage = "Checking existing Cloudflare resources…",
  requirePhrase = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  targets: InstallResourceProbe[];
  confirmLabel: string;
  onConfirm: (phrase: string | null) => void;
  confirming?: boolean;
  checking?: boolean;
  checkingMessage?: string;
  /** Always type DELETE ME — used for rollback so an empty probe cannot one-click wipe. */
  requirePhrase?: boolean;
}) {
  const [phrase, setPhrase] = useState("");
  const [armed, setArmed] = useState(false);
  const occupied = targets.filter(resourceIsOccupied);
  const needsPhrase = requirePhrase || occupied.length > 0;
  const acceptedNames = [
    ...new Set([...occupied.map((r) => r.name), WIPE_PROJECT_NAME]),
  ];
  const canConfirm =
    !checking &&
    armed &&
    (!needsPhrase || wipePhraseIsValid(phrase, acceptedNames));

  useEffect(() => {
    if (!open) {
      setArmed(false);
      return;
    }
    setPhrase("");
    setArmed(false);
    const t = window.setTimeout(() => setArmed(true), 400);
    return () => window.clearTimeout(t);
  }, [open]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {checking ? (
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
            <span>{checkingMessage}</span>
          </div>
        ) : null}
        {!checking && targets.length > 0 ? (
          <ul className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
            {targets.map((r) => {
              const summary = occupancySummary(r);
              return (
                <li
                  key={`${r.kind}:${r.name}`}
                  className="flex items-start gap-2"
                >
                  <CloudflareModuleIcon
                    kind={kindLabel(r.kind)}
                    className="mt-0.5 size-4 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="font-mono text-xs">
                      <span className="text-muted-foreground">
                        {kindLabel(r.kind)}
                      </span>{" "}
                      <span className="font-medium">{r.name}</span>
                    </p>
                    {summary ? (
                      <p
                        className={
                          r.occupied
                            ? "text-[11px] text-amber-700 dark:text-amber-400"
                            : "text-[11px] text-muted-foreground"
                        }
                      >
                        {summary}
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">
                        No stored data
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
        {!checking && needsPhrase ? (
          <div className="space-y-2">
            <Label htmlFor="install-wipe-phrase">
              Type <span className="font-mono">{WIPE_PHRASE_DELETE_ME}</span> or{" "}
              <span className="font-mono">{WIPE_PROJECT_NAME}</span> to
              permanently delete
            </Label>
            <Input
              id="install-wipe-phrase"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder={WIPE_PHRASE_DELETE_ME}
              autoComplete="off"
              autoFocus
              disabled={confirming || checking}
            />
          </div>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={confirming || checking}>Cancel</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={!canConfirm || confirming}
            onClick={() => onConfirm(needsPhrase ? phrase.trim() : null)}
          >
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
