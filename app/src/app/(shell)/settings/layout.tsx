import { SettingsTabLayout } from "@/console/pages/settings/SettingsTabLayout";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <SettingsTabLayout>{children}</SettingsTabLayout>;
}
