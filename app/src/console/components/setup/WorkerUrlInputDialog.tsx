"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  buildDefaultWorkerUrl,
  isValidWorkerUrl,
  normalizeWorkerUrl,
  parseDefaultWorkerSubdomain,
} from "@/lib/desktop/worker-url/worker-url";

type WorkerUrlInputDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (url: string) => void;
  initialUrl?: string;
};

/**
 * Worker URL entry dialog for unlock / login flows.
 * Auto tab builds relaybase-api.{account}.workers.dev; Manual tab accepts any https URL.
 */
export function WorkerUrlInputDialog({
  open,
  onOpenChange,
  onConfirm,
  initialUrl = "",
}: WorkerUrlInputDialogProps) {
  const normalizedInitial = normalizeWorkerUrl(initialUrl);
  const initialSubdomain = parseDefaultWorkerSubdomain(normalizedInitial);

  const [tab, setTab] = useState<"auto" | "manual">("auto");
  const [accountName, setAccountName] = useState(initialSubdomain ?? "");
  const [customUrl, setCustomUrl] = useState(
    initialSubdomain ? "" : normalizedInitial,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const subdomain = parseDefaultWorkerSubdomain(normalizedInitial);
    setTab("auto");
    setAccountName(subdomain ?? "");
    setCustomUrl(subdomain ? "" : normalizedInitial);
    setError(null);
  }, [open, normalizedInitial]);

  const previewUrl = buildDefaultWorkerUrl(accountName);

  function handleConfirm() {
    const url =
      tab === "auto"
        ? buildDefaultWorkerUrl(accountName)
        : normalizeWorkerUrl(customUrl);
    if (!url) {
      setError(
        tab === "auto"
          ? "Enter your Cloudflare account name."
          : "Enter a Worker URL.",
      );
      return;
    }
    if (!isValidWorkerUrl(url)) {
      setError("Enter a valid https:// Worker URL.");
      return;
    }
    setError(null);
    onConfirm(url);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enter Worker URL</DialogTitle>
          <DialogDescription>
            Pick the default pattern from your Cloudflare account name, or paste
            a custom URL.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          defaultValue="auto"
          onValueChange={(value) => {
            setTab(value as "auto" | "manual");
            setError(null);
          }}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="auto">Auto</TabsTrigger>
            <TabsTrigger value="manual">Manual</TabsTrigger>
          </TabsList>

          <TabsContent value="auto" className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="worker-account-name">Cloudflare account name</Label>
              <Input
                id="worker-account-name"
                value={accountName}
                onChange={(e) => {
                  setAccountName(e.target.value);
                  setError(null);
                }}
                placeholder="gssisaac"
                autoComplete="off"
                autoFocus={tab === "auto"}
              />
              <p className="text-xs text-muted-foreground">
                Builds{" "}
                <span className="font-mono">
                  {previewUrl ||
                    "https://relaybase-api.[account].workers.dev"}
                </span>
              </p>
            </div>
          </TabsContent>

          <TabsContent value="manual" className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="worker-custom-url">Worker URL</Label>
              <Input
                id="worker-custom-url"
                value={customUrl}
                onChange={(e) => {
                  setCustomUrl(e.target.value);
                  setError(null);
                }}
                placeholder="https://relaybase-api.<subdomain>.workers.dev"
                className="font-mono text-xs"
                autoComplete="off"
                autoFocus={tab === "manual"}
              />
            </div>
          </TabsContent>
        </Tabs>

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm}>
            Use URL
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
