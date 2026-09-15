import type { ReactNode } from "react";

import { AutomationDetailSectionLayout } from "@/scale/pages/automations/AutomationDetailShell";

export default function AutomationDetailLayout({ children }: { children: ReactNode }) {
  return <AutomationDetailSectionLayout>{children}</AutomationDetailSectionLayout>;
}
