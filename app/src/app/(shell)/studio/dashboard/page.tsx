import { StudioDashboardView } from "@/studio/pages/overview/StudioDashboardView";
import { DashboardProvider } from "@/studio/stores/dashboard";

export default function StudioDashboardPage() {
  return (
    <DashboardProvider>
      <StudioDashboardView />
    </DashboardProvider>
  );
}
