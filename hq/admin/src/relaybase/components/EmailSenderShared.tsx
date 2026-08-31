"use client";

import { RefreshCw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function EmailSenderAlerts({
  error,
  message,
}: {
  error: string | null;
  message: string | null;
}) {
  return (
    <>
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {message ? (
        <Alert>
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
    </>
  );
}

export function EmailSenderToolbar({
  refreshing,
  onRefresh,
  cacheHint,
}: {
  refreshing: boolean;
  onRefresh: () => void;
  cacheHint?: string | null;
}) {
  return (
    <div className="flex items-center justify-end gap-3">
      {cacheHint ? (
        <span className="text-xs text-muted-foreground">{cacheHint}</span>
      ) : null}
      <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
        <RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} />
        Refresh
      </Button>
    </div>
  );
}
