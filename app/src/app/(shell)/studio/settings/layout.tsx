import type { ReactNode } from "react";

import { StudioSettingsShell } from "@/studio/pages/settings/StudioSettingsShell";

export default function Layout({ children }: { children: ReactNode }) {
  return <StudioSettingsShell>{children}</StudioSettingsShell>;
}
