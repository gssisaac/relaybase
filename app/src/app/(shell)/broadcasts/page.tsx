import { redirect } from "next/navigation";

/** Broadcasts live under CRM campaigns — keep legacy /broadcasts links working. */
export default function Page() {
  redirect("/crm/campaigns");
}
