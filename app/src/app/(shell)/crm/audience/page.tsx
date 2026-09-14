import { AudienceRouteProvider } from "@/crm/pages/audience/AudienceRouteContext";
import { AudienceView } from "@/crm/pages/audience/AudienceView";

export default function Page() {
  return (
    <AudienceRouteProvider audienceRoot="/crm/audience">
      <AudienceView />
    </AudienceRouteProvider>
  );
}
