import { DesktopDashboardGate } from "@/app/(dashboard)/DesktopDashboardGate";

/** Fixed local operator id — matches ~/.relaybase/mail/desktop/. */
export const LOCAL_OPERATOR_USER_ID = "desktop";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // No cookie login. Every run mode uses the same local operator + Worker.
  return (
    <DesktopDashboardGate userId={LOCAL_OPERATOR_USER_ID}>
      {children}
    </DesktopDashboardGate>
  );
}
