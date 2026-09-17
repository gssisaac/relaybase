import { VerifiedAccountsProvider } from "@/studio/stores/verified-accounts";
import { AudienceRouteProvider } from "@/studio/pages/audience/AudienceRouteContext";
import { AudienceView } from "@/studio/pages/audience/AudienceView";

export default function Page() {
  return (
    <VerifiedAccountsProvider>
      <AudienceRouteProvider audienceRoot="/studio/subscribers">
        <AudienceView />
      </AudienceRouteProvider>
    </VerifiedAccountsProvider>
  );
}
