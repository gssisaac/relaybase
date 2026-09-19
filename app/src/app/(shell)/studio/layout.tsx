import type { ReactNode } from "react";

import { HqStudioGate } from "@/lib/hq-auth/HqStudioGate";

export default function StudioLayout({ children }: { children: ReactNode }) {
  return <HqStudioGate>{children}</HqStudioGate>;
}
