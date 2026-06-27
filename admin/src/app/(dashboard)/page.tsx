import { redirect } from "next/navigation";

import { EMAIL_SENDER_DEFAULT_TAB } from "@/relaybase/components/constants";

export default function AdminHomePage() {
  redirect(`/${EMAIL_SENDER_DEFAULT_TAB}`);
}
