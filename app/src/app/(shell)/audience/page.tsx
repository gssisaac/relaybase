import { redirect } from "next/navigation";

/**
 * Audience management now lives inside each Campaign's Subscribers tab in
 * CRM mode (docs/features/crm-campaign-broadcast-subscriber-model.md) —
 * keep legacy /audience links working by landing on the campaign list.
 */
export default function Page() {
  redirect("/crm/campaigns");
}
