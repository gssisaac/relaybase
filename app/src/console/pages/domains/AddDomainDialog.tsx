"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { useDomain } from "@/lib/dashboard/DomainContext";
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
    store.queueAddDomain(trimmed, true);
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
        <p className="text-xs text-muted-foreground">
          Only domains already managed on your Cloudflare account can be added.
        </p>
      </DialogContent>
    </Dialog>
  );
}
