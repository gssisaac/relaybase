"use client";

import { TeamLoginView } from "@/console/components/setup/TeamLoginView";

/**
 * Standalone invited (team) login. The same form is rendered inside the
 * dashboard gate when the store is in the `invitedLogin` phase; this page is
 * the entry point from the welcome "I was invited" choice.
 */
export default function TeamLoginPage() {
  return <TeamLoginView />;
}
