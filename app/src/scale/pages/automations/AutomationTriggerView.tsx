"use client";

import { AutomationTriggerSection } from "@/scale/pages/automations/AutomationTriggerSection";

/** @deprecated Trigger UI lives on Settings; kept for direct imports. */
export function AutomationTriggerView() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4">
      <AutomationTriggerSection />
    </div>
  );
}
