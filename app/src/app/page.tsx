import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { RestoreLastRoute } from "@/components/RestoreLastRoute";

export default async function HomePage() {
  // Static desktop export cannot call cookies(); Tauri entry restores via localStorage.
  if (process.env.DESKTOP_BUILD === "1") {
    return <RestoreLastRoute fallbackUserId="desktop" />;
  }

  const jar = await cookies();
  const userId = jar.get("relaybase_user")?.value?.trim();
  if (!userId) redirect("/login");
  return <RestoreLastRoute userId={userId} />;
}
