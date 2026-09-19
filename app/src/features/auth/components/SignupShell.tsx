import type { ReactNode } from "react";

import { SignupPageHeader } from "@/features/auth/components/SignupPageHeader";
import { cn } from "@/lib/utils";

export function SignupShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-10",
        className,
      )}
    >
      <SignupPageHeader />
      {children}
    </div>
  );
}
