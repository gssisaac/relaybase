import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { UserSidebar } from "@/components/layout/UserSidebar";
import { DomainProvider } from "@/lib/dashboard/DomainContext";
import { ensureUserAuthToken } from "@/lib/dev-email-store";
import { SessionProvider } from "@/lib/dashboard/shared/ProductContext";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jar = await cookies();
  const userId = jar.get("relaybase_user")?.value?.trim();
  if (!userId) redirect("/login");

  ensureUserAuthToken(userId);

  return (
    <SessionProvider userId={userId}>
      <DomainProvider>
        <div className="flex min-h-svh bg-background">
          <UserSidebar />
          <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {children}
          </main>
        </div>
      </DomainProvider>
    </SessionProvider>
  );
}
