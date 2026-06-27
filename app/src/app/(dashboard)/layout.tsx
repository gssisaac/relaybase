import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { UserHeader } from "@/components/layout/UserHeader";
import { SessionProvider } from "@/lib/dashboard/shared/ProductContext";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jar = await cookies();
  const userId = jar.get("relaybase_user")?.value?.trim();
  if (!userId) redirect("/login");

  return (
    <SessionProvider userId={userId}>
      <div className="flex min-h-svh flex-col">
        <UserHeader />
        {children}
      </div>
    </SessionProvider>
  );
}
