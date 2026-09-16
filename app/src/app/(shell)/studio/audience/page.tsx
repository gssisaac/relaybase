import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Legacy URL — Subscribers live at `/studio/subscribers`. */
export default async function LegacyAudiencePage({ searchParams }: Props) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string") params.set(key, value);
    else if (Array.isArray(value)) {
      for (const entry of value) params.append(key, entry);
    }
  }
  const q = params.toString();
  redirect(q ? `/studio/subscribers?${q}` : "/studio/subscribers");
}
