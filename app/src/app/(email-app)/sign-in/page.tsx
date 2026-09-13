"use client";

import { AccountLoginView } from "@/console/components/setup/AccountLoginView";

/**
 * Web sign-in — unified Account Login (owner passtoken or teammate
 * password). Desktop keeps its separate choice/unlock/team-login flow via
 * SessionPhaseScreen; this route only ever renders for the web build.
 */
export default function SignInPage() {
  return <AccountLoginView />;
}
