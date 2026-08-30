"use client";

import { Loader2 } from "lucide-react";

export function BootScreen() {
  return (
    <div className="flex h-svh items-center justify-center text-muted-foreground">
      <Loader2 className="size-5 animate-spin" aria-label="Loading" />
    </div>
  );
}
