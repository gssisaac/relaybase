"use client";

import { ArrowRight } from "lucide-react";
import { useEffect } from "react";

import { DownloadCtaLabel } from "@/components/download-cta-label";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  ensureDownloadClientId,
  getMacDownloadAction,
  type DownloadButtonLocation,
} from "@/features/download-access/client";

type DownloadMacButtonClientProps = {
  href: string;
  location: DownloadButtonLocation;
  size?: "default" | "sm" | "lg";
  showArrow?: boolean;
  disabled?: boolean;
};

export function DownloadMacButtonClient({
  href,
  location,
  size = "lg",
  showArrow = false,
  disabled = false,
}: DownloadMacButtonClientProps) {
  useEffect(() => {
    if (!disabled) {
      ensureDownloadClientId();
    }
  }, [disabled]);

  if (disabled) {
    return (
      <Button size={size} disabled>
        <DownloadCtaLabel />
        {showArrow ? <ArrowRight data-icon="inline-end" /> : null}
      </Button>
    );
  }

  const action = getMacDownloadAction({ href, location });

  return (
    <a
      href={action.href}
      onPointerDown={action.onPointerDown}
      className={cn(buttonVariants({ size }))}
    >
      <DownloadCtaLabel />
      {showArrow ? <ArrowRight data-icon="inline-end" /> : null}
    </a>
  );
}
