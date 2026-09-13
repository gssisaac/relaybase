"use client";

import { PanelLeft } from "lucide-react";

import { useOptionalAppShellNav } from "@/components/layout/app-shell-nav";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MobileNavTrigger({ className }: { className?: string }) {
  const nav = useOptionalAppShellNav();
  if (!nav?.isMobile) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn("-ml-1 shrink-0", className)}
      aria-label="Open menu"
      onClick={nav.openNav}
    >
      <PanelLeft className="size-4" aria-hidden />
    </Button>
  );
}
