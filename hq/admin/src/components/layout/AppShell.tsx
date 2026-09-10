"use client";

import { usePathname } from "next/navigation";

import { AdminSidebar } from "@/components/layout/AdminSidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return (
      <main className="flex min-h-screen min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </main>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
