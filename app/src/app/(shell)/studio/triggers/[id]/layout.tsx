import type { ReactNode } from "react";

import { TriggerDetailProvider } from "@/studio/pages/triggers/TriggerDetailContext";

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
  let triggerId = id;
  try {
    triggerId = decodeURIComponent(id);
  } catch {
    /* keep raw */
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <TriggerDetailProvider key={triggerId} triggerId={triggerId}>
        {children}
      </TriggerDetailProvider>
    </div>
  );
}
