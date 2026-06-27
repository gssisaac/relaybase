import { redirect } from "next/navigation";

import { RelaybaseEmailPanelView } from "@/relaybase-email/panel";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ path: string[] }> };

export default async function Page({ params }: Props) {
  const { path } = await params;
  return <RelaybaseEmailPanelView subPath={path} />;
}
