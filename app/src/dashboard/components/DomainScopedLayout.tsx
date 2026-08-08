"use client";

import type { ReactNode } from "react";

import { DomainNavSidebar } from "@/dashboard/components/DomainNavSidebar";

export function DomainScopedLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <DomainNavSidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
        <div className="mx-auto w-full max-w-[1200px] space-y-4 p-4">
          {children}
        </div>
      </div>
    </div>
  );
}
