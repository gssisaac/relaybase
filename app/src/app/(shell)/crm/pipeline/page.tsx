import { redirect } from "next/navigation";

/** Pipeline UI removed — keep legacy /crm/pipeline links working. */
export default function Page() {
  redirect("/crm/campaigns");
}
