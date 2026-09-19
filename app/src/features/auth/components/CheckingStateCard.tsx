"use client";

import { CloudflareModuleIcon } from "@/console/components/CloudflareModuleIcon";
import { cn } from "@/lib/utils";

export function CheckingStateCard({
  title = "Checking Cloudflare Resources",
  description = "Inspecting your Cloudflare account for existing Relaybase Workers, D1 databases, and R2 storage…",
  className,
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[260px] w-full flex-col items-center justify-center rounded-xl border border-border/70 bg-card/50 p-8 text-center shadow-xs backdrop-blur-xs",
        className,
      )}
    >
      <div className="relative mb-6 flex size-18 items-center justify-center">
        {/* Animated outer ping ring */}
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#F38020]/20 duration-1000" />
        {/* Glowing middle circle */}
        <div className="absolute inset-1 rounded-full bg-[#F38020]/10" />
        {/* Inner brand icon circle */}
        <div className="relative flex size-14 items-center justify-center rounded-full border border-[#F38020]/30 bg-background shadow-xs">
          <CloudflareModuleIcon
            kind="Worker"
            className="size-7 animate-pulse text-[#F38020]"
          />
        </div>
      </div>
      <p className="text-base font-semibold tracking-tight text-foreground">{title}</p>
      <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
