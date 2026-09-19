import type { ReactNode } from "react";

/** Full-viewport scroll — root body uses overflow-hidden; long Step 2 domain lists need this. */
export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-0 overflow-y-auto overscroll-y-contain bg-background">
      <div className="flex min-h-full w-full justify-center px-4 py-6 sm:py-10">
        {children}
      </div>
    </div>
  );
}
