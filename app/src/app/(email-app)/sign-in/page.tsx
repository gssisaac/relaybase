"use client";

import { AccountLoginView } from "@/console/components/setup/AccountLoginView";

/**
 * Backup web sign-in — same Account Login as `/setup/connect` and `/login`.
 * Primary entry is `/setup` (welcome choice), matching desktop.
 */
export default function SignInPage() {
  return <AccountLoginView />;
}
