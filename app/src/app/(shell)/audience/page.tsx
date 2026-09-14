import { redirect } from "next/navigation";

/** Audience management lives in CRM mode — keep legacy /audience links working. */
export default function Page() {
  redirect("/crm/audience");
}
