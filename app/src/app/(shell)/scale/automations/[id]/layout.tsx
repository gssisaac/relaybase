import type { ReactNode } from "react";

import { AutomationDetailProvider } from "@/scale/pages/automations/AutomationDetailContext";

export function generateStaticParams() {
  return [];
}

export default async function AutomationIdLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let automationId = id;
  try {
    automationId = decodeURIComponent(id);
  } catch {
    /* keep raw */
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AutomationDetailProvider key={automationId} automationId={automationId}>
        {children}
      </AutomationDetailProvider>
    </div>
  );
}
