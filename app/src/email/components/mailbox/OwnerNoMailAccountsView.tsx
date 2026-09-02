"use client";

import { Mails } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { EmptyListState } from "@/email/components/mailbox/EmailListShell";
import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import { useAppSession } from "@/lib/desktop/app-session";
import {
  DEFAULT_DASHBOARD_PATH,
  readLastPath,
  writeSidebarMode,
} from "@/lib/navigation/sidebar-mode";

/**
 * Owner mailbox with no enabled accounts — not an empty Inbox.
 * First install lands here instead of folder chrome + "Inbox is empty".
 */
export function OwnerNoMailAccountsView() {
  const router = useRouter();
  const session = useAppSession();
  const userId = useProductId();

  async function goToConsole() {
    const unlocked = await session.ensureConsoleAccess();
    if (!unlocked && !session.consoleGateOpen) return;
    writeSidebarMode(userId, "dashboard");
    router.push(readLastPath(userId, "dashboard") || DEFAULT_DASHBOARD_PATH);
  }

  return (
    <EmptyListState
      icon={Mails}
      title="No mail accounts"
      description="Add a domain address in the console to start receiving mail."
      action={
        <Button
          type="button"
          size="sm"
          disabled={session.busy}
          onClick={() => void goToConsole()}
        >
          Go to console
        </Button>
      }
    />
  );
}
