import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { DesktopDashboardGate } from "@/app/(dashboard)/DesktopDashboardGate";
import { ensureUserAuthToken } from "@/lib/dev-email-store";
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

  // Page content only — DesktopDashboardGate owns the single sidebar shell.
  // (Tauri pointing at next dev must not nest a second sidebar.)
  return (
    <DesktopDashboardGate userId={userId}>{children}</DesktopDashboardGate>
  );
}
