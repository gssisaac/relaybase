import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<{ id?: string }>;
};

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const id = params.id?.trim();
  if (!id) {
    redirect("/studio/messages");
  }
  redirect(`/studio/messages/edit?id=${encodeURIComponent(id)}`);
}
