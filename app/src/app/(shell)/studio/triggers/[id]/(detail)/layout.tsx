import type { ReactNode } from "react";

import { TriggerDetailSectionLayout } from "@/studio/pages/triggers/TriggerDetailShell";

export default function AutomationDetailLayout({ children }: { children: ReactNode }) {
  return <TriggerDetailSectionLayout>{children}</TriggerDetailSectionLayout>;
}
