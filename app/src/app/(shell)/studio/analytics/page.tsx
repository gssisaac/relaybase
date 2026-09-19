import { StudioAnalyticsView } from "@/studio/pages/overview/StudioAnalyticsView";
import { AnalyticsProvider } from "@/studio/stores/analytics";

export default function StudioAnalyticsPage() {
  return (
    <AnalyticsProvider>
      <StudioAnalyticsView />
    </AnalyticsProvider>
  );
}
