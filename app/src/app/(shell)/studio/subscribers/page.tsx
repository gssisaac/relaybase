import { VerifiedAccountsProvider } from "@/studio/stores/verified-accounts";
import { SubscriberRouteProvider } from "@/studio/pages/subscribers/SubscriberRouteContext";
import { SubscribersView } from "@/studio/pages/subscribers/SubscribersView";
import { SubscriberGroupsProvider } from "@/studio/stores/subscriber-groups";

export default function Page() {
  return (
    <VerifiedAccountsProvider>
      <SubscriberGroupsProvider>
        <SubscriberRouteProvider subscribersRoot="/studio/subscribers">
          <SubscribersView />
        </SubscriberRouteProvider>
      </SubscriberGroupsProvider>
    </VerifiedAccountsProvider>
  );
}
