"use client";

import { ExternalLink, Plus } from "lucide-react";
import { useState } from "react";

import { useDomain } from "@/lib/dashboard/DomainContext";
import {
  GOOGLE_WORKSPACE_MIGRATION_DOC_URL,
  desktopOpenExternal,
} from "@/lib/desktop/bridge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AddDomainDialog({
  open: openProp,
  onOpenChange,
  showTrigger = true,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
} = {}) {
  const store = useDomain();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  const [value, setValue] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const trimmed = value.trim().toLowerCase();
  const existing = new Set(
    store.domains.map((d) => d.domain.trim().toLowerCase()),
  );
  const canSubmit = trimmed.length > 0 && !existing.has(trimmed);

  function reset() {
    setValue("");
    setLocalError(null);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  function handleSubmit() {
    if (!trimmed) {
      setLocalError("Enter a domain.");
      return;
    }
    if (existing.has(trimmed)) {
      setLocalError("This domain is already in Relaybase.");
      return;
    }
    store.queueAddDomain(trimmed);
    reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {showTrigger ? (
        <DialogTrigger render={<Button size="sm" />}>
          <Plus className="size-4" />
          Add domain
        </DialogTrigger>
      ) : null}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add domain</DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          <Label htmlFor="add-domain-name" className="text-xs">
            Domain
          </Label>
          <Input
            id="add-domain-name"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setLocalError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="example.com"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        {localError ? (
          <p className="text-sm text-destructive">{localError}</p>
        ) : trimmed && existing.has(trimmed) ? (
          <p className="text-sm text-destructive">
            This domain is already in Relaybase.
          </p>
        ) : null}
        <Button className="w-full" disabled={!canSubmit} onClick={handleSubmit}>
          Add domain
        </Button>
        <div className="rounded-md border border-border/70 bg-muted/30 p-2.5 text-xs space-y-1.5">
          <p className="text-muted-foreground">
            Only domains already managed on your Cloudflare account can be added.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Using Google Workspace or another mail provider? Root domains cannot share MX records with Email Routing.{" "}
            <button
              type="button"
              className="inline-flex items-center gap-0.5 font-medium text-brand hover:underline"
              onClick={() =>
                void desktopOpenExternal(GOOGLE_WORKSPACE_MIGRATION_DOC_URL)
              }
            >
              Read Coexistence Guide
              <ExternalLink className="size-2.5" />
            </button>{" "}
            or add a subdomain (e.g. <span className="font-mono">mail.yourdomain.com</span>).
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
