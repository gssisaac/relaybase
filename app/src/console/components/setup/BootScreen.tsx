"use client";

import { Loader2 } from "lucide-react";

export function BootScreen() {
  return (
    <div className="flex h-svh flex-col items-center justify-center gap-4 text-muted-foreground">
      <img
        src="/icon.png"
        alt=""
        width={48}
        height={48}
        className="size-12"
      />
      <Loader2 className="size-5 animate-spin" aria-label="Loading" />
    </div>
  );
}
