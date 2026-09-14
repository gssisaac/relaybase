import { AudienceGroupsView } from "@/console/pages/audience/AudienceGroupsView";
import { AudienceRouteProvider } from "@/console/pages/audience/AudienceRouteContext";

export default function Page() {
  return (
    <AudienceRouteProvider audienceRoot="/crm/audience">
      <AudienceGroupsView />
    </AudienceRouteProvider>
  );
}
