import { cn } from "@/lib/utils";

/** Relaybase app icon — centered above auth form titles (matches `/setup` and loading screen). */
export function AuthPageBrandMark({ className }: { className?: string }) {
  return (
    <img
      src="/icon.png"
      alt=""
      width={48}
      height={48}
      className={cn("size-12", className)}
    />
  );
}
