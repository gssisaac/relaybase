import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const jar = await cookies();
  const userId = jar.get("relaybase_user")?.value?.trim();
  if (userId) redirect("/dashboard");
  redirect("/login");
}
