import { TriggersView } from "@/studio/pages/triggers/TriggersView";
import { TriggersHubProvider } from "@/studio/stores/triggers-hub";

export default function Page() {
  return (
    <TriggersHubProvider>
      <TriggersView />
    </TriggersHubProvider>
  );
}
