import { UserDetailView } from "@/components/users/UserDetailView";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function UserDetailPage({ params }: Props) {
  const { id } = await params;
  return <UserDetailView userId={id} />;
}
