"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Matches `/setup` welcome shell: `h-full justify-center px-6 pb-24`. */
export const SETUP_PAGE_SHELL =
  "mx-auto flex h-full w-full flex-col justify-center px-6 pb-24";

export function SetupBackLink({
  className,
  onClick,
  href = "/setup",
  label = "Back to start",
}: {
  className?: string;
  onClick?: () => void | Promise<void>;
  href?: string;
  label?: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline",
        className,
      )}
      onClick={() => {
        void Promise.resolve(onClick?.()).finally(() => {
          router.push(href);
        });
      }}
    >
      <ArrowLeft className="size-3" />
      {label}
    </button>
  );
}

/** Vertically centered setup subpage (sign-in, connect). Back link sits just above the card. */
export function SetupCenteredPage({
  children,
  maxWidth = "max-w-md",
  backHref,
  backLabel,
}: {
  children: ReactNode;
  maxWidth?: "max-w-md" | "max-w-3xl";
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className={cn(SETUP_PAGE_SHELL, maxWidth)}>
      <div className="w-full space-y-3">
        <div className="flex justify-end">
          <SetupBackLink href={backHref} label={backLabel} />
        </div>
        {children}
      </div>
    </div>
  );
}

/** Scrollable setup subpage shell (install, progress). Place SetupBackLink above the card in the page. */
export function SetupScrollPage({
  children,
  maxWidth = "max-w-3xl",
}: {
  children: ReactNode;
  maxWidth?: "max-w-md" | "max-w-3xl";
}) {
  return (
    <div className={cn("mx-auto w-full px-6 py-6", maxWidth)}>{children}</div>
  );
}
