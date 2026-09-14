import { AudienceGroupsView } from "@/crm/pages/audience/AudienceGroupsView";
import { AudienceRouteProvider } from "@/crm/pages/audience/AudienceRouteContext";

export default function Page() {
  return (
    <AudienceRouteProvider audienceRoot="/crm/audience">
      <AudienceGroupsView />
    </AudienceRouteProvider>
  );
}
