import { DesktopDashboardGate } from "@/app/_shell/DesktopDashboardGate";
import { EmailShell } from "@/email/components/mailbox/EmailShell";

/** Fixed local operator id — matches ~/.relaybase/mail/desktop/. */
export const LOCAL_OPERATOR_USER_ID = "desktop";

export default async function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // No cookie login. Every run mode uses the same local operator + Worker.
  // EmailShell wraps every shell route and auto-selects full-bleed (mailbox)
  // vs padded (dashboard list) based on the pathname — see EmailShell.
  return (
    <DesktopDashboardGate userId={LOCAL_OPERATOR_USER_ID}>
      <EmailShell>{children}</EmailShell>
    </DesktopDashboardGate>
  );
}
