import { AudienceRouteProvider } from "@/scale/pages/audience/AudienceRouteContext";
import { AudienceView } from "@/scale/pages/audience/AudienceView";

export default function Page() {
  return (
    <AudienceRouteProvider audienceRoot="/scale/audience">
      <AudienceView />
    </AudienceRouteProvider>
  );
}
