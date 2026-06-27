import { redirect } from "next/navigation";

import { RELAYBASE_DEFAULT_TAB } from "@/relaybase/components/constants";

export default function AdminHomePage() {
  redirect(`/${RELAYBASE_DEFAULT_TAB}`);
}
