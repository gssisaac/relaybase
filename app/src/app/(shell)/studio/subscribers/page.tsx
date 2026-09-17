import { VerifiedAccountsProvider } from "@/studio/stores/verified-accounts";
import { SubscriberRouteProvider } from "@/studio/pages/subscribers/SubscriberRouteContext";
import { SubscribersView } from "@/studio/pages/subscribers/SubscribersView";

export default function Page() {
  return (
    <VerifiedAccountsProvider>
      <SubscriberRouteProvider subscribersRoot="/studio/subscribers">
        <SubscribersView />
      </SubscriberRouteProvider>
    </VerifiedAccountsProvider>
  );
}
