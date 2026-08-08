import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { DesktopDashboardGate } from "@/app/(dashboard)/DesktopDashboardGate";
import { UserSidebar } from "@/components/layout/UserSidebar";
import { DomainProvider } from "@/lib/dashboard/DomainContext";
import { DomainProgressBanner } from "@/relaybase-email/components/DomainProgressBanner";
import { ensureUserAuthToken } from "@/lib/dev-email-store";
import { SessionProvider } from "@/lib/dashboard/shared/ProductContext";
import { getUser } from "@/lib/users-store";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Static desktop export skips cookie auth; Tauri shell handles onboarding.
  if (process.env.DESKTOP_BUILD === "1") {
    return <DesktopDashboardGate>{children}</DesktopDashboardGate>;
  }

  const jar = await cookies();
  const userId = jar.get("relaybase_user")?.value?.trim();
  if (!userId) redirect("/login");

  const user = await getUser(userId);
  if (!user) redirect("/login");

  await ensureUserAuthToken(userId);

  return (
    <DesktopDashboardGate>
      <SessionProvider userId={userId}>
        <DomainProvider>
          <div className="flex h-svh overflow-hidden bg-background">
            <UserSidebar />
            <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <DomainProgressBanner />
              {children}
            </main>
          </div>
        </DomainProvider>
      </SessionProvider>
    </DesktopDashboardGate>
  );
}
