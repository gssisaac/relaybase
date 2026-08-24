"use client";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { WorkerUpdateTarget } from "@/lib/desktop/bridge";

export function WorkerUpdateTargetDialog({
  open,
  target,
  confirming,
  onOpenChange,
  onConfirm,
  onAuthorizeAgain,
}: {
  open: boolean;
  target: WorkerUpdateTarget | null;
  confirming?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onAuthorizeAgain: () => void;
}) {
  const matches = Boolean(target?.matches);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {matches ? "Confirm Worker URL" : "Wrong Cloudflare account"}
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          {matches
            ? "This Cloudflare login owns the Worker Relaybase already uses. Confirm the URL before we upload anything."
            : "This Cloudflare login would update a different Worker. Nothing was uploaded."}
        </p>
        <div className="space-y-3 rounded-md border border-border bg-muted/40 px-3 py-2.5 text-xs">
          <div>
            <p className="text-muted-foreground">Your saved Worker</p>
            <p className="mt-0.5 break-all font-mono">
              {target?.expectedWorkerUrl || "—"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">This Cloudflare account</p>
            <p className="mt-0.5 break-all font-mono">
              {target?.oauthWorkerUrl || "—"}
            </p>
            {target?.oauthAccountId ? (
              <p className="mt-1 break-all font-mono text-muted-foreground">
                account {target.oauthAccountId}
              </p>
            ) : null}
          </div>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {matches ? (
            <Button
              className="w-full"
              disabled={!target || confirming}
              onClick={onConfirm}
            >
              {confirming ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Update this Worker
            </Button>
          ) : null}
          <Button
            variant={matches ? "outline" : "default"}
            className="w-full"
            onClick={onAuthorizeAgain}
          >
            Authorize a different account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
