import { VerifiedAccountsProvider } from "@/lib/scale/VerifiedAccountsContext";
import { AudienceRouteProvider } from "@/scale/pages/audience/AudienceRouteContext";
import { AudienceView } from "@/scale/pages/audience/AudienceView";

export default function Page() {
  return (
    <VerifiedAccountsProvider>
      <AudienceRouteProvider audienceRoot="/scale/subscribers">
        <AudienceView />
      </AudienceRouteProvider>
    </VerifiedAccountsProvider>
  );
}
